import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NearbyTownsRequest {
  project_id: string;
  location: string;
  radius: number; // in kilometers
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    console.log("Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasGoogleApiKey: !!googleApiKey,
    });

    if (!googleApiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // For now, skip JWT verification during development
    // TODO: Re-enable JWT verification for production
    // const authHeader = req.headers.get("Authorization");
    // if (authHeader) {
    //   const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    //   if (userError) console.warn("Auth error:", userError);
    // }

    const requestBody = await req.json();
    console.log("Request body:", requestBody);

    const { project_id, location, radius }: NearbyTownsRequest = requestBody;

    // Google Places API has a max radius of 50,000 meters (50km / ~31 miles)
    // Cap the radius to stay within limits
    const radiusInMeters = Math.min(radius * 1000, 50000);
    
    console.log("🗺️ Finding nearby towns for:", location, "within", radius, "km", "(capped at", radiusInMeters / 1000, "km)");

    // Step 1: Geocode the base location to get lat/lng
    const textSearchResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.location,places.addressComponents",
        },
        body: JSON.stringify({
          textQuery: location,
          locationBias: {
            circle: {
              center: { latitude: 54.0, longitude: -2.0 }, // UK center
              radius: 500000.0, // 500km
            },
          },
        }),
      }
    );

    if (!textSearchResponse.ok) {
      const errorText = await textSearchResponse.text();
      throw new Error(
        `Google Places API error (geocoding): ${textSearchResponse.status} - ${errorText}`
      );
    }

    const textSearchData = await textSearchResponse.json();
    const basePlace = textSearchData.places?.[0];

    if (!basePlace) {
      throw new Error(`Location "${location}" not found`);
    }

    const { latitude, longitude } = basePlace.location;
    console.log("📍 Base location coordinates:", { latitude, longitude });

    // Step 2: Search for nearby towns/localities within the radius
    const nearbySearchResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.location,places.types,places.addressComponents",
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: { latitude, longitude },
              radius: radiusInMeters, // Already capped at 50,000 meters
            },
          },
          includedTypes: ["locality", "postal_town"],
          maxResultCount: 20,
        }),
      }
    );

    if (!nearbySearchResponse.ok) {
      const errorText = await nearbySearchResponse.text();
      throw new Error(
        `Google Places API error (nearby search): ${nearbySearchResponse.status} - ${errorText}`
      );
    }

    const nearbyData = await nearbySearchResponse.json();
    const places = nearbyData.places || [];

    console.log(`✅ Found ${places.length} nearby towns`);

    // Step 3: Extract location data
    const extractRegion = (addressComponents: any[]): string | undefined => {
      const adminArea = addressComponents?.find(
        (c) =>
          c.types.includes("administrative_area_level_2") ||
          c.types.includes("administrative_area_level_1")
      );
      return adminArea?.longText || adminArea?.shortText;
    };

    const extractCountry = (addressComponents: any[]): string => {
      const country = addressComponents?.find((c) => c.types.includes("country"));
      return country?.shortText || "GB";
    };

    const towns = places.map((place: any) => ({
      place_id: place.id,
      name: place.displayName.text,
      lat: place.location.latitude,
      lng: place.location.longitude,
      region: extractRegion(place.addressComponents),
      country: extractCountry(place.addressComponents),
    }));

    // Store locations in database
    const locationsToInsert = towns.map((town: any) => ({
      project_id,
      place_id: town.place_id,
      name: town.name,
      slug: town.name.toLowerCase().replace(/\s+/g, "-"),
      lat: town.lat,
      lng: town.lng,
      region: town.region,
      country: town.country,
    }));

    // Use upsert with ignoreDuplicates to skip existing locations
    const { data, error } = await supabase
      .from("project_locations")
      .upsert(locationsToInsert, {
        onConflict: "project_id,place_id",
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw error;

    console.log(
      `💾 Stored ${data?.length || 0} new locations (${
        locationsToInsert.length - (data?.length || 0)
      } were duplicates)`
    );

    // Update the project with the base location's coordinates
    await supabase
      .from("projects")
      .update({
        latitude,
        longitude,
      })
      .eq("id", project_id);

    return new Response(
      JSON.stringify({
        success: true,
        locations_count: towns.length,
        new_locations_count: data?.length || 0,
        towns,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error finding nearby towns:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

