package com.ohmeomuk.recommendation;

import com.ohmeomuk.recommendation.Models.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class RecommendationEngine {
  private record Candidate(Place place, Cuisine cuisine, String food, int distance, double score) {}

  public Response recommend(List<Place> places, Request req, boolean random) {
    Map<String, Place> distinct = new LinkedHashMap<>();
    places.forEach(p -> distinct.putIfAbsent(p.id(), p));
    List<Candidate> eligible = new ArrayList<>();
    int matching = 0;
    for (var p : distinct.values()) {
      double meters = distance(req.latitude(), req.longitude(), p.latitude(), p.longitude());
      if (meters > req.radiusMeters()) continue;
      Cuisine c = classify(p.category());
      String food = food(p.category());
      if (!random
          && (!req.categories().isEmpty() && (c == null || !req.categories().contains(c))
              || excluded(p.category(), req.exclude()))) continue;
      matching++;
      if (req.excludedPlaceIds().contains(p.id())) continue;
      double distanceScore =
          1 - 0.7 * Math.max(0, meters - 200) / Math.max(1, req.radiusMeters() - 200);
      double style = styleScore(food, req.mealStyle());
      eligible.add(
          new Candidate(p, c, food, (int) Math.round(meters), 0.45 * distanceScore + 0.55 * style));
    }
    int count = eligible.size();
    Collections.shuffle(eligible);
    List<Candidate> selected = new ArrayList<>();
    while (!eligible.isEmpty() && selected.size() < (random ? 1 : 3)) {
      Candidate next =
          random
              ? eligible.getFirst()
              : eligible.stream()
                  .max(
                      Comparator.comparingDouble(
                          c ->
                              c.score()
                                  - selected.stream()
                                          .mapToDouble(s -> similarity(c, s))
                                          .max()
                                          .orElse(0)
                                      * 0.22))
                  .orElseThrow();
      selected.add(next);
      eligible.remove(next);
    }
    List<Result> results =
        selected.stream()
            .map(
                c ->
                    new Result(
                        c.place().id(),
                        c.place().name(),
                        label(c.cuisine()),
                        c.food(),
                        c.distance(),
                        random ? "이동거리 안의 후보 중 무작위로 골랐어요." : reason(c, req),
                        c.place().address(),
                        c.place().phone(),
                        c.place().placeUrl()))
            .toList();
    List<String> notices = new ArrayList<>(List.of("거리는 직선거리예요. 실제 가격과 영업 여부는 카카오맵에서 확인해 주세요."));
    if (!random && !req.exclude().isEmpty())
      notices.add("제외 조건은 음식점 분류 기준이에요. 실제 재료·메뉴 구성은 확인이 필요해요.");
    if (!random && req.mealStyle() != Style.ANY)
      notices.add("식사 스타일은 음식 종류로 추정하며 양·대기시간을 보장하지 않아요.");
    return new Response(results, count, matching > 0 && count == 0, notices);
  }

  public static double distance(double a, double b, double c, double d) {
    double x = Math.toRadians(c - a), y = Math.toRadians(d - b);
    double h =
        Math.pow(Math.sin(x / 2), 2)
            + Math.cos(Math.toRadians(a))
                * Math.cos(Math.toRadians(c))
                * Math.pow(Math.sin(y / 2), 2);
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  }

  static Cuisine classify(String s) {
    if (has(s, "샐러드", "샌드위치")) return Cuisine.SALAD;
    if (has(s, "패스트푸드", "햄버거")) return Cuisine.FAST_FOOD;
    if (has(s, "분식")) return Cuisine.SNACK;
    if (has(s, "중식", "중국요리", "마라")) return Cuisine.CHINESE;
    if (has(s, "일식", "일본식", "돈까스", "돈가스", "초밥")) return Cuisine.JAPANESE;
    if (has(s, "양식", "이탈리안", "피자", "파스타", "스테이크")) return Cuisine.WESTERN;
    if (has(s, "한식", "국밥", "한정식")) return Cuisine.KOREAN;
    return null;
  }

  static String food(String s) {
    if (has(s, "국밥", "해장국")) return "국밥";
    if (has(s, "돈까스", "돈가스")) return "돈까스";
    if (has(s, "샐러드", "샌드위치")) return "샐러드·샌드위치";
    if (has(s, "초밥", "스시")) return "초밥";
    if (has(s, "햄버거")) return "햄버거";
    if (has(s, "피자")) return "피자";
    if (has(s, "국수", "냉면", "라멘", "라면", "우동", "파스타", "중국요리")) return "면 요리";
    if (has(s, "고기", "육류", "삼겹살", "갈비", "불고기")) return "고기 요리";
    String[] parts = s.split(" > ");
    return parts.length > 1 ? parts[parts.length - 1] : "음식점";
  }

  static boolean excluded(String s, List<Exclusion> exclusions) {
    for (var e : exclusions) {
      boolean match =
          switch (e) {
            case SPICY -> has(s, "마라", "매운", "불닭", "떡볶이", "아구찜");
            case SOUP -> has(s, "국밥", "해장국", "찌개", "전골", "탕류", "라멘", "샤브");
            case NOODLES -> has(s, "국수", "냉면", "라면", "라멘", "우동", "파스타", "중국요리");
            case RICE -> has(s, "국밥", "덮밥", "비빔밥", "김밥", "초밥", "죽");
            case MEAT ->
                has(
                    s, "육류", "고기", "삼겹살", "갈비", "돈까스", "돈가스", "치킨", "닭", "족발", "보쌈", "햄버거", "순대",
                    "국밥");
          };
      if (match) return true;
    }
    return false;
  }

  private static double styleScore(String food, Style s) {
    return switch (s) {
      case ANY -> 0.5;
      case HEARTY -> has(food, "국밥", "돈까스", "고기") ? 1 : 0.5;
      case LIGHT -> has(food, "샐러드", "샌드위치") ? 1 : 0.5;
      case QUICK -> has(food, "햄버거", "김밥", "분식", "샌드위치") ? 1 : 0.5;
    };
  }

  private static double similarity(Candidate a, Candidate b) {
    if (a.food().equals(b.food())) return 1;
    return a.cuisine() != null && a.cuisine() == b.cuisine() ? 0.4 : 0;
  }

  private static String reason(Candidate c, Request r) {
    if (r.mealStyle() != Style.ANY && styleScore(c.food(), r.mealStyle()) == 1)
      return "선택한 식사 스타일과 어울리는 음식 종류예요.";
    if (!r.categories().isEmpty()) return "고른 음식 종류이고 설정한 이동거리 안에 있어요.";
    return "이동거리 안에서 서로 다른 음식 종류를 골랐어요.";
  }

  private static boolean has(String s, String... words) {
    return Arrays.stream(words).anyMatch(s::contains);
  }

  private static String label(Cuisine c) {
    if (c == null) return "기타";
    return switch (c) {
      case KOREAN -> "한식";
      case CHINESE -> "중식";
      case JAPANESE -> "일식";
      case WESTERN -> "양식";
      case SNACK -> "분식";
      case FAST_FOOD -> "패스트푸드";
      case SALAD -> "샐러드";
    };
  }
}
