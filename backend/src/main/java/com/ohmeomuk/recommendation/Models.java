package com.ohmeomuk.recommendation;

import jakarta.validation.constraints.*;
import java.util.List;

public final class Models {
  public enum Cuisine {
    KOREAN,
    CHINESE,
    JAPANESE,
    WESTERN,
    SNACK,
    FAST_FOOD,
    SALAD
  }

  public enum Style {
    ANY,
    HEARTY,
    LIGHT,
    QUICK
  }

  public enum Exclusion {
    SPICY,
    SOUP,
    NOODLES,
    RICE,
    MEAT
  }

  public record Request(
      @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
      @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
      @Min(100) @Max(3000) int radiusMeters,
      @NotNull @Size(max = 7) List<@NotNull Cuisine> categories,
      @NotNull Style mealStyle,
      @NotNull @Size(max = 5) List<@NotNull Exclusion> exclude,
      @NotNull @Size(max = 150) List<@NotBlank @Size(max = 64) String> excludedPlaceIds) {}

  public record Place(
      String id,
      String name,
      String category,
      String address,
      double longitude,
      double latitude,
      String phone,
      String placeUrl) {}

  public record Result(
      String id,
      String name,
      String category,
      String foodType,
      int distanceMeters,
      String reason,
      String address,
      String phone,
      String placeUrl) {}

  public record Response(
      List<Result> restaurants, int candidateCount, boolean exhausted, List<String> notices) {}

  public record LocationRequest(@NotBlank @Size(max = 100) String query) {}

  public record Location(
      String id, String name, String address, double latitude, double longitude) {}
}
