export type PlaceCategory =
  | 'food'
  | 'cafe'
  | 'transit'
  | 'lodging'
  | 'shopping'
  | 'attraction'
  | 'park'
  | 'medical'
  | 'education'
  | 'default';

type PlaceCategoryDefinition = {
  category: PlaceCategory;
  types: ReadonlySet<string>;
};

const defineCategory = (
  category: PlaceCategory,
  types: readonly string[],
): PlaceCategoryDefinition => ({
  category,
  types: new Set(types),
});

const PLACE_CATEGORY_DEFINITIONS: readonly PlaceCategoryDefinition[] = [
  defineCategory('cafe', ['cafe', 'bakery', 'coffee_shop']),
  defineCategory('food', [
    'restaurant',
    'food',
    'meal_takeaway',
    'meal_delivery',
    'bar',
    'night_club',
  ]),
  defineCategory('transit', [
    'airport',
    'bus_station',
    'ferry_terminal',
    'light_rail_station',
    'subway_station',
    'taxi_stand',
    'train_station',
    'transit_station',
  ]),
  defineCategory('lodging', [
    'bed_and_breakfast',
    'campground',
    'guest_house',
    'hostel',
    'hotel',
    'lodging',
    'motel',
    'resort_hotel',
  ]),
  defineCategory('shopping', [
    'book_store',
    'clothing_store',
    'convenience_store',
    'department_store',
    'electronics_store',
    'florist',
    'furniture_store',
    'hardware_store',
    'home_goods_store',
    'jewelry_store',
    'shoe_store',
    'shopping_mall',
    'store',
    'supermarket',
  ]),
  defineCategory('park', ['national_park', 'park']),
  defineCategory('attraction', [
    'amusement_park',
    'aquarium',
    'art_gallery',
    'cultural_landmark',
    'historical_landmark',
    'movie_theater',
    'museum',
    'tourist_attraction',
    'zoo',
  ]),
  defineCategory('medical', [
    'clinic',
    'dentist',
    'doctor',
    'hospital',
    'medical_lab',
    'pharmacy',
    'physiotherapist',
  ]),
  defineCategory('education', [
    'library',
    'preschool',
    'primary_school',
    'school',
    'secondary_school',
    'university',
  ]),
] as const;

export function resolvePlaceCategoryFromTypes(
  types: readonly (string | null | undefined)[],
): PlaceCategory {
  const normalizedTypes = new Set(
    types.flatMap((type) => (type ? [type.trim().toLowerCase()] : [])),
  );
  for (const definition of PLACE_CATEGORY_DEFINITIONS) {
    if (
      Array.from(definition.types).some((type) => normalizedTypes.has(type))
    ) {
      return definition.category;
    }
  }
  return 'default';
}
