# 오머먹

로그인 없이 쓰는 점심 추천 서비스. **설문 추천 최대 3곳**, **랜덤 추천 1곳**을 제공합니다.

## 실행

필요 환경: Node.js 20.9 이상, Java 21 이상, Maven 3.6.3 이상.

1. 루트 `.env`에 `KAKAO_REST_API_KEY=...`를 설정합니다. 기존 `kakao_map_api=...` 이름도 지원합니다. JavaScript 앱 키가 아닌 REST API 키가 필요합니다.
2. `npm --prefix frontend install`
3. `./scripts/dev.sh`
4. http://localhost:3000 접속

개별 실행: `mvn -f backend/pom.xml spring-boot:run`, `npm --prefix frontend run dev`.

키는 Spring Boot에서만 읽고 Next.js에는 전달하지 않습니다. `.env`는 Git에서 제외합니다.

## 구성

- `frontend`: Next.js App Router, TypeScript, Tailwind CSS, 반응형 화면.
- `backend`: Java / Spring Boot, Kakao Local API, Caffeine 5분 후보 캐시.
- `POST /api/v1/recommendations/survey`: 설문·거리 필터 + 스타일 점수 + 다양성 재정렬.
- `POST /api/v1/recommendations/random`: 확보한 반경 내 후보에서 균등 무작위 추첨.
- `POST /api/v1/locations/search`: 주소·장소 키워드 검색.
- `GET /api/v1/health`: 서버 상태.

추천 요청 예시:

```json
{"latitude":37.5,"longitude":127.0,"radiusMeters":500,"categories":[],"mealStyle":"ANY","exclude":[],"excludedPlaceIds":[]}
```

음식 종류: KOREAN, CHINESE, JAPANESE, WESTERN, SNACK, FAST_FOOD, SALAD.
식사 스타일: ANY, HEARTY, LIGHT, QUICK.
제외: SPICY, SOUP, NOODLES, RICE, MEAT.
반경: 100~3000m. 다시 추천은 `excludedPlaceIds`로 이미 표시한 장소를 제외합니다.

## 검증

```sh
mvn -f backend/pom.xml test
npm --prefix frontend run typecheck
npm --prefix frontend run build
npx --prefix frontend playwright install chromium
npm --prefix frontend run test:e2e
```

## 동작과 한계

- 로그인, 장기 사용자 추적, DB 저장을 사용하지 않습니다. 이번 범위에는 저장 데이터가 없어 PostgreSQL/JPA를 추가하지 않았습니다.
- 사용자 위치·선택·설문은 브라우저 메모리에만 유지하며 새로고침하면 초기화합니다.
- 위치 권한 거부 시 장소/주소를 검색할 수 있습니다. 운영 환경 Geolocation은 HTTPS가 필요합니다.
- 거리 표시는 직선거리이며 실제 도보 경로나 시간을 의미하지 않습니다.
- 설문 제외는 카카오 음식점 분류에 근거한 필터이며, 실제 메뉴·재료의 부재를 보증하지 않습니다.
- 가격·리뷰·영업시간을 생성하지 않습니다. 상세 확인은 카카오맵 링크를 사용합니다.
- 조회는 FD6, 최대 3페이지/45개 문서로 제한합니다. 랜덤은 확보한 후보 안에서 수행하며 지역 전체 음식점의 무작위 표본은 아닙니다.
- Caffeine 키는 약 100m 좌표 격자이며 사용자와 연결하지 않습니다. 실제 기준점 거리로 다시 필터링합니다.
- 외부 검색 장애는 오류로 표시하며 가짜 음식점이나 샘플 결과로 대체하지 않습니다.
- 기본 백엔드 바인딩은 loopback입니다. 단일 서버 전체 POST 제한은 분당 120회입니다. 운영 프록시에는 신뢰 가능한 클라이언트 IP 기준 제한과 16KB 본문 제한을 추가하세요.
- Next.js는 `/api/*`를 `BACKEND_URL`(기본 http://127.0.0.1:8080)로 전달합니다. 별도 컨테이너 배포에서는 내부 네트워크 주소와 `SERVER_ADDRESS`를 설정하세요.

카카오 Local API: https://developers.kakao.com/docs/ko/local/dev-guide
