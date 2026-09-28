import { test, expect } from "@playwright/test";
const places = [1, 2, 3].map((id) => ({
  id: String(id),
  name: "테스트 음식점 " + id,
  category: "한식",
  foodType: "국밥",
  distanceMeters: 200,
  reason: "조건에 맞는 음식점이에요.",
  address: "서울시 테스트 주소",
  phone: "",
  placeUrl: "https://place.map.kakao.com/" + id,
}));
test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 37.5665, longitude: 126.978 });
});
test("survey sends conditions, renders three results, selects and excludes previous places", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/v1/recommendations/survey", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.categories).toEqual(["KOREAN"]);
    expect(body.exclude).toEqual(["SPICY"]);
    if (calls++) expect(body.excludedPlaceIds).toEqual(["1", "2", "3"]);
    await route.fulfill({
      json: {
        restaurants: calls === 1 ? places : [],
        candidateCount: 3,
        exhausted: calls > 1,
        notices: [],
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /맞춤 추천 시작하기/ }).click();
  await page.getByRole("button", { name: "🍚 한식", exact: true }).click();
  await page.getByRole("button", { name: "매운 음식", exact: true }).click();
  await page.getByRole("button", { name: "내 점심 추천받기" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "이걸로 먹기" }).first().click();
  await expect(page.getByRole("status")).toContainText("맛있는 점심");
  await page.getByRole("button", { name: "다른 곳 추천" }).click();
  await expect(page.getByText("한 바퀴 다 둘러봤어요")).toBeVisible();
});
test("random returns one and can redraw without repeating", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/v1/recommendations/random", async (route) => {
    const b = route.request().postDataJSON();
    expect(b.radiusMeters).toBe(500);
    expect(b.categories).toEqual([]);
    if (calls) expect(b.excludedPlaceIds).toEqual(["1"]);
    await route.fulfill({
      json: {
        restaurants: [places[calls++]],
        candidateCount: 3,
        exhausted: false,
        notices: [],
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /랜덤으로 뽑기/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "테스트 음식점 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다시 뽑기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "테스트 음식점 2" }),
  ).toBeVisible();
});
test("permission denial supports manual location search", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_success: unknown, error: (e: unknown) => void) =>
          error({ code: 1 }),
      },
    });
  });
  await page.route("**/api/v1/locations/search", (r) =>
    r.fulfill({
      json: [
        {
          id: "station",
          name: "성수역",
          address: "서울 성동구",
          latitude: 37.54,
          longitude: 127.05,
        },
      ],
    }),
  );
  await page.route("**/api/v1/recommendations/random", (r) =>
    r.fulfill({
      json: {
        restaurants: [places[0]],
        candidateCount: 1,
        exhausted: false,
        notices: [],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /랜덤으로 뽑기/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "주소 또는 역 이름" }).fill("성수역");
  await page.getByRole("button", { name: "장소 검색" }).click();
  await page.getByRole("button", { name: "성수역 서울 성동구" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
});
test("upstream failure stays an error without fabricated results", async ({
  page,
}) => {
  await page.route("**/api/v1/recommendations/random", (r) =>
    r.fulfill({
      status: 503,
      json: { message: "카카오 API 설정을 확인해 주세요." },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /랜덤으로 뽑기/ }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "카카오 API 설정" }),
  ).toContainText("카카오 API 설정");
  await expect(page.getByRole("article")).toHaveCount(0);
});
test("mobile home has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/ohmeomuk-mobile.png", fullPage: true });
});
