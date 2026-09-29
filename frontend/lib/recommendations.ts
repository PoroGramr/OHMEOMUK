export type Mode = "survey" | "random";

export type Place = {
  id: string;
  name: string;
  category: string;
  foodType: string;
  distanceMeters: number;
  reason: string;
  address: string;
  phone: string;
  placeUrl: string;
};

export type Reply = {
  restaurants: Place[];
  candidateCount: number;
  exhausted: boolean;
  notices: string[];
};
