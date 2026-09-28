package com.ohmeomuk.recommendation;

import static org.assertj.core.api.Assertions.*;

import com.ohmeomuk.recommendation.Models.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class RecommendationEngineTest {
  final RecommendationEngine engine = new RecommendationEngine();

  Place place(String id, String category, double latitude) {
    return new Place(
        id, "음식점" + id, category, "서울", 127, latitude, "", "https://place.map.kakao.com/" + id);
  }

  Request request(List<Cuisine> cats, List<Exclusion> exclude, List<String> seen) {
    return new Request(37.5, 127.0, 500, cats, Style.ANY, exclude, seen);
  }

  @Test
  void surveyFiltersCategoryRadiusAndDeduplicates() {
    var a = place("1", "음식점 > 한식 > 국밥", 37.5001);
    var result =
        engine.recommend(
            List.of(a, a, place("2", "음식점 > 일식", 37.5001), place("3", "음식점 > 한식", 37.52)),
            request(List.of(Cuisine.KOREAN), List.of(), List.of()),
            false);
    assertThat(result.restaurants()).extracting(Result::id).containsExactly("1");
  }

  @Test
  void randomReturnsOneAndDoesNotApplySurveyPreferences() {
    var result =
        engine.recommend(
            List.of(place("1", "한식 > 국밥", 37.5001)),
            request(List.of(Cuisine.JAPANESE), List.of(Exclusion.MEAT), List.of()),
            true);
    assertThat(result.restaurants()).hasSize(1);
  }

  @Test
  void noRepeatsAndExhaustionIsDistinctFromEmptySearch() {
    var p = place("1", "한식", 37.5001);
    assertThat(
            engine
                .recommend(List.of(p), request(List.of(), List.of(), List.of("1")), true)
                .exhausted())
        .isTrue();
    assertThat(
            engine.recommend(List.of(), request(List.of(), List.of(), List.of()), true).exhausted())
        .isFalse();
  }

  @Test
  void diversityPrefersDifferentFoodTypes() {
    var list =
        List.of(
            place("1", "한식 > 국밥", 37.5001),
            place("2", "한식 > 국밥", 37.5001),
            place("3", "한식 > 국밥", 37.5001),
            place("4", "일식 > 초밥", 37.5001),
            place("5", "양식 > 피자", 37.5001));
    var result = engine.recommend(list, request(List.of(), List.of(), List.of()), false);
    assertThat(result.restaurants())
        .extracting(Result::foodType)
        .doesNotHaveDuplicates()
        .hasSize(3);
  }

  @Test
  void exclusionAndUnknownCategoryAreHandled() {
    assertThat(RecommendationEngine.excluded("한식 > 육류,고기요리", List.of(Exclusion.MEAT))).isTrue();
    var result =
        engine.recommend(
            List.of(place("1", "음식점", 37.5001)),
            request(List.of(Cuisine.KOREAN), List.of(), List.of()),
            false);
    assertThat(result.restaurants()).isEmpty();
  }

  @Test
  void exactRadiusIsCheckedBeforeRounding() {
    assertThat(RecommendationEngine.distance(37.5, 127, 37.5, 127)).isZero();
    assertThat(
            engine
                .recommend(
                    List.of(place("1", "한식", 37.51)),
                    request(List.of(), List.of(), List.of()),
                    true)
                .restaurants())
        .isEmpty();
  }
}
