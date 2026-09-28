package com.ohmeomuk.infrastructure;

import com.github.benmanes.caffeine.cache.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestGuard extends OncePerRequestFilter {
  private final Cache<String, AtomicInteger> counters =
      Caffeine.newBuilder().maximumSize(10000).expireAfterWrite(Duration.ofMinutes(1)).build();

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.getMethod().equals("POST")) {
      // Backend is loopback-only by default. A global limit also protects the shared API key behind
      // the frontend proxy.
      int count = counters.get("global", k -> new AtomicInteger()).incrementAndGet();
      if (count > 120) {
        res.setStatus(429);
        res.setHeader("Retry-After", "60");
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"message\":\"요청이 많아요. 1분 후 다시 시도해 주세요.\"}");
        return;
      }
      if (req.getContentLengthLong() > 16384) {
        res.sendError(413);
        return;
      }
    }
    chain.doFilter(req, res);
  }
}
