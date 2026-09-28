package com.ohmeomuk.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.*;
import com.ohmeomuk.recommendation.Models.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class KakaoClient {
  private final String key;
  private final ObjectMapper mapper;
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofMillis(800)).build();
  private final Cache<String, List<Place>> cache =
      Caffeine.newBuilder().maximumSize(500).expireAfterWrite(Duration.ofMinutes(5)).build();

  public KakaoClient(@Value("${kakao.api-key}") String key, ObjectMapper mapper) {
    this.key = key;
    this.mapper = mapper;
  }

  public List<Place> nearby(double lat, double lon, int radius) {
    // Shared cache uses a coarse grid, never a user identifier or exact GPS position.
    double y = Math.round(lat * 1000) / 1000.0, x = Math.round(lon * 1000) / 1000.0;
    return cache.get(
        y + ":" + x + ":" + radius,
        k -> {
          Map<String, Place> places = new LinkedHashMap<>();
          long deadline = System.nanoTime() + Duration.ofSeconds(4).toNanos();
          for (int page = 1; page <= 3; page++) {
            var uri =
                base("category")
                    .queryParam("category_group_code", "FD6")
                    .queryParam("x", x)
                    .queryParam("y", y)
                    .queryParam("radius", radius + 100)
                    .queryParam("sort", "distance")
                    .queryParam("size", 15)
                    .queryParam("page", page)
                    .build()
                    .toUri();
            var json = get(uri, deadline);
            for (var d : json.path("documents")) {
              Place p = place(d);
              if (p != null) places.putIfAbsent(p.id(), p);
            }
            if (json.path("meta").path("is_end").asBoolean(true)) break;
          }
          return List.copyOf(places.values());
        });
  }

  public List<Location> locations(String query) {
    var json =
        get(
            base("keyword")
                .queryParam("query", query)
                .queryParam("size", 8)
                .build()
                .encode()
                .toUri(),
            System.nanoTime() + Duration.ofSeconds(3).toNanos());
    List<Location> out = new ArrayList<>();
    for (var d : json.path("documents")) {
      var p = place(d);
      if (p != null)
        out.add(new Location(p.id(), p.name(), p.address(), p.latitude(), p.longitude()));
    }
    if (out.isEmpty()) {
      json =
          get(
              base("address")
                  .queryParam("query", query)
                  .queryParam("size", 8)
                  .build()
                  .encode()
                  .toUri(),
              System.nanoTime() + Duration.ofSeconds(3).toNanos());
      for (var d : json.path("documents")) {
        try {
          out.add(
              new Location(
                  d.path("address_name").asText(),
                  d.path("address_name").asText(),
                  d.path("address_name").asText(),
                  Double.parseDouble(d.path("y").asText()),
                  Double.parseDouble(d.path("x").asText())));
        } catch (NumberFormatException ignored) {
        }
      }
    }
    return out;
  }

  private UriComponentsBuilder base(String type) {
    return UriComponentsBuilder.fromUriString(
        "https://dapi.kakao.com/v2/local/search/" + type + ".json");
  }

  private JsonNode get(URI uri, long deadline) {
    if (key.isBlank()) throw new ProviderException("API_KEY_MISSING", "카카오 REST API 키 설정이 필요해요.");
    try {
      long remaining = deadline - System.nanoTime();
      if (remaining <= 0)
        throw new ProviderException("PROVIDER_TIMEOUT", "음식점 검색이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.");
      var req =
          HttpRequest.newBuilder(uri)
              .header("Authorization", "KakaoAK " + key)
              .timeout(Duration.ofNanos(Math.min(remaining, Duration.ofSeconds(2).toNanos())))
              .GET()
              .build();
      var res = http.send(req, HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() == 401 || res.statusCode() == 403)
        throw new ProviderException(
            "PROVIDER_CONFIGURATION", "카카오 API 키 또는 로컬 API 사용 설정을 확인해 주세요.");
      if (res.statusCode() == 429)
        throw new ProviderException("PROVIDER_LIMIT", "검색 요청이 많아요. 잠시 후 다시 시도해 주세요.");
      if (res.statusCode() != 200)
        throw new ProviderException("PROVIDER_UNAVAILABLE", "음식점 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return mapper.readTree(res.body());
    } catch (ProviderException e) {
      throw e;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ProviderException("PROVIDER_UNAVAILABLE", "검색이 중단되었어요.");
    } catch (Exception e) {
      throw new ProviderException("PROVIDER_UNAVAILABLE", "음식점 검색에 연결하지 못했어요. 다시 시도해 주세요.");
    }
  }

  private Place place(JsonNode d) {
    try {
      double x = Double.parseDouble(d.path("x").asText()),
          y = Double.parseDouble(d.path("y").asText());
      String id = d.path("id").asText();
      if (!id.matches("[0-9]+")
          || !Double.isFinite(x)
          || !Double.isFinite(y)
          || Math.abs(x) > 180
          || Math.abs(y) > 90) return null;
      String road = d.path("road_address_name").asText();
      return new Place(
          id,
          d.path("place_name").asText(),
          d.path("category_name").asText(),
          road.isBlank() ? d.path("address_name").asText() : road,
          x,
          y,
          d.path("phone").asText(),
          "https://place.map.kakao.com/" + id);
    } catch (NumberFormatException e) {
      return null;
    }
  }

  public static class ProviderException extends RuntimeException {
    public final String code;

    public ProviderException(String code, String message) {
      super(message);
      this.code = code;
    }
  }
}
