package com.ohmeomuk.recommendation;

import com.ohmeomuk.infrastructure.KakaoClient;
import com.ohmeomuk.recommendation.Models.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class RecommendationController {
  private final KakaoClient kakao;
  private final RecommendationEngine engine;

  public RecommendationController(KakaoClient kakao, RecommendationEngine engine) {
    this.kakao = kakao;
    this.engine = engine;
  }

  @PostMapping("/recommendations/survey")
  public Response survey(@Valid @RequestBody Request req) {
    return run(req, false);
  }

  @PostMapping("/recommendations/random")
  public Response random(@Valid @RequestBody Request req) {
    return run(req, true);
  }

  @PostMapping("/locations/search")
  public List<Location> locations(@Valid @RequestBody LocationRequest req) {
    return kakao.locations(req.query().trim());
  }

  @GetMapping("/health")
  public java.util.Map<String, String> health() {
    return java.util.Map.of("status", "ok");
  }

  private Response run(Request r, boolean random) {
    if (!Double.isFinite(r.latitude()) || !Double.isFinite(r.longitude()))
      throw new IllegalArgumentException();
    return engine.recommend(kakao.nearby(r.latitude(), r.longitude(), r.radiusMeters()), r, random);
  }
}
