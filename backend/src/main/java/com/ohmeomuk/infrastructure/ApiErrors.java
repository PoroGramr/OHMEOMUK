package com.ohmeomuk.infrastructure;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(KakaoClient.ProviderException.class)
  ResponseEntity<?> provider(KakaoClient.ProviderException e) {
    return ResponseEntity.status(503).body(Map.of("code", e.code, "message", e.getMessage()));
  }

  @ExceptionHandler({
    MethodArgumentNotValidException.class,
    HttpMessageNotReadableException.class,
    IllegalArgumentException.class
  })
  ResponseEntity<?> invalid(Exception e) {
    return ResponseEntity.badRequest()
        .body(Map.of("code", "INVALID_REQUEST", "message", "위치와 추천 조건을 다시 확인해 주세요."));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unexpected(Exception e) {
    return ResponseEntity.internalServerError()
        .body(Map.of("code", "INTERNAL_ERROR", "message", "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."));
  }
}
