"use client";
import { useState, useRef, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Shuffle,
  SlidersHorizontal,
  ChevronLeft,
  LocateFixed,
  Search,
  X,
  Check,
  Utensils,
  Sparkles,
  LoaderCircle,
  Share2,
} from "lucide-react";

import type { Mode, Reply } from "../lib/recommendations";
import {
  createRecommendationShareUrl,
  readSharedRecommendation,
  SHARE_HASH_KEY,
} from "../lib/share-recommendation";

type Location = { latitude: number; longitude: number; name: string };
const categories = [
  ["KOREAN", "한식", "🍚"],
  ["CHINESE", "중식", "🥟"],
  ["JAPANESE", "일식", "🍣"],
  ["WESTERN", "양식", "🍝"],
  ["SNACK", "분식", "🍢"],
  ["FAST_FOOD", "패스트푸드", "🍔"],
  ["SALAD", "샐러드", "🥗"],
];
const styles = [
  ["ANY", "상관없어요"],
  ["HEARTY", "든든하게"],
  ["LIGHT", "가볍게"],
  ["QUICK", "빠르게"],
];
const exclusions = [
  ["SPICY", "매운 음식"],
  ["SOUP", "국물"],
  ["NOODLES", "면"],
  ["RICE", "밥"],
  ["MEAT", "고기"],
];
async function api<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch("/api/v1/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({
      message: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
    }));
    if (!r.ok) throw new Error(data.message || "요청을 처리하지 못했어요.");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export default function Home() {
  const [view, setView] = useState<"home" | "survey" | "results">("home");
  const [mode, setMode] = useState<Mode>("survey");
  const [radius, setRadius] = useState(500);
  const [cats, setCats] = useState<string[]>([]);
  const [style, setStyle] = useState("ANY");
  const [exclude, setExclude] = useState<string[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<
    (Location & { id: string; address: string })[]
  >([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [manualShareUrl, setManualShareUrl] = useState("");
  const shareInFlight = useRef(false);
  const pending = useRef<Mode | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    function openSharedRecommendation() {
      try {
        const snapshot = readSharedRecommendation(window.location.hash);
        if (!snapshot) return;
        setMode(snapshot.mode);
        setRadius(snapshot.radius);
        setReply({
          restaurants: snapshot.restaurants,
          candidateCount: snapshot.restaurants.length,
          exhausted: false,
          notices: snapshot.notices,
        });
        setShared(true);
        setSelected(null);
        setShareMessage("");
        setManualShareUrl("");
        setError("");
        setView("results");
      } catch (e) {
        setView("home");
        setShared(false);
        setReply(null);
        setError(e instanceof Error ? e.message : "공유 링크를 열지 못했어요.");
      }
    }
    openSharedRecommendation();
    window.addEventListener("hashchange", openSharedRecommendation);
    return () =>
      window.removeEventListener("hashchange", openSharedRecommendation);
  }, []);

  function clearSharedRecommendation() {
    if (window.location.hash.startsWith(`#${SHARE_HASH_KEY}=`)) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    setShared(false);
    setShareMessage("");
    setManualShareUrl("");
  }

  function goHome() {
    clearSharedRecommendation();
    setView("home");
    setError("");
  }

  async function shareRecommendation() {
    if (!reply?.restaurants.length || shareInFlight.current) return;
    shareInFlight.current = true;
    setSharing(true);
    setShareMessage("");
    setManualShareUrl("");
    try {
      const url = createRecommendationShareUrl(window.location.origin, {
        mode,
        radius,
        restaurants: reply.restaurants,
        notices: reply.notices,
      });
      const data = {
        title: "오머먹 — 오늘의 점심 추천",
        text: "오늘 점심 여기 어때요? 오머먹 추천을 함께 봐요.",
        url,
      };
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare(data))
      ) {
        try {
          await navigator.share(data);
          return;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
        }
      }
      try {
        if (!navigator.clipboard?.writeText) throw new Error();
        await navigator.clipboard.writeText(url);
        setShareMessage(
          "추천 링크를 복사했어요. 함께 먹을 사람에게 보내보세요!",
        );
      } catch {
        setManualShareUrl(url);
        setShareMessage("아래 링크를 선택해서 복사해 주세요.");
      }
    } catch {
      setShareMessage("공유 링크를 만들지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSharing(false);
      shareInFlight.current = false;
    }
  }
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  useEffect(() => {
    if (!locationOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locating) {
        pending.current = null;
        setLocationOpen(false);
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".location-modal button:not(:disabled), .location-modal input",
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [locationOpen, locating]);
  function toggle(
    list: string[],
    value: string,
    setter: (v: string[]) => void,
  ) {
    setter(
      list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
    );
  }
  async function recommend(
    nextMode: Mode,
    loc: Location,
    reset = false,
    customRadius = radius,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setSelected(null);
    setMode(nextMode);
    try {
      const omitted = reset ? [] : seen;
      const data = await api<Reply>("recommendations/" + nextMode, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusMeters: customRadius,
        categories: nextMode === "survey" ? cats : [],
        mealStyle: nextMode === "survey" ? style : "ANY",
        exclude: nextMode === "survey" ? exclude : [],
        excludedPlaceIds: omitted,
      });
      clearSharedRecommendation();
      setReply(data);
      setSeen([...omitted, ...data.restaurants.map((x) => x.id)].slice(-150));
      setView("results");
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "AbortError"
          ? e.message
          : "연결이 늦어지고 있어요. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function gps(nextMode: Mode | null) {
    if (locating) return;
    setLocating(true);
    setLocationError("");
    setError("");
    if (!navigator.geolocation) {
      setLocationError(
        "이 브라우저에서는 위치를 가져올 수 없어요. 장소를 검색해 주세요.",
      );
      setLocationOpen(true);
      pending.current = nextMode;
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          name: "현재 내 위치",
        };
        setLocation(loc);
        setLocating(false);
        setLocationOpen(false);
        pending.current = null;
        if (nextMode)
          void recommend(
            nextMode,
            loc,
            true,
            nextMode === "random" ? 500 : radius,
          );
      },
      () => {
        setLocationError(
          "위치를 가져오지 못했어요. 주소나 역 이름을 검색해 주세요.",
        );
        setLocationOpen(true);
        pending.current = nextMode;
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  function start(nextMode: Mode) {
    if (busy || locating) return;
    setMode(nextMode);
    if (nextMode === "random") setRadius(500);
    if (location)
      void recommend(
        nextMode,
        location,
        true,
        nextMode === "random" ? 500 : radius,
      );
    else void gps(nextMode);
  }
  async function searchLocation() {
    if (!query.trim() || searching) return;
    setSearching(true);
    setLocationError("");
    setSearched(false);
    try {
      setLocations(await api("locations/search", { query: query.trim() }));
      setSearched(true);
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : "검색하지 못했어요.");
    } finally {
      setSearching(false);
    }
  }
  function chooseLocation(loc: Location) {
    clearSharedRecommendation();
    setLocation(loc);
    setLocationOpen(false);
    setSeen([]);
    setReply(null);
    if (view === "results") setView(mode === "survey" ? "survey" : "home");
    if (pending.current) {
      const next = pending.current;
      pending.current = null;
      void recommend(next, loc, true, next === "random" ? 500 : radius);
    }
  }
  const waiting = busy || locating;
  return (
    <div className="app-shell">
      <header className="header">
        <button
          className="brand"
          onClick={() => {
            if (!waiting) {
              goHome();
            }
          }}
          aria-label="오머먹 홈"
        >
          <span className="brand-icon">
            <Utensils size={18} />
          </span>
          오머먹<span className="brand-dot">.</span>
        </button>
        <button
          className="location-button"
          onClick={() => {
            pending.current = null;
            setLocationOpen(true);
            setLocationError("");
          }}
          disabled={waiting}
        >
          <MapPin size={15} />
          <span>{location?.name || "내 위치 설정"}</span>
          <span className="small-arrow">⌄</span>
        </button>
      </header>
      <main>
        {view === "home" && (
          <>
            <section className="hero">
              <div className="eyebrow">
                <span /> YOUR LITTLE LUNCH HELPER
              </div>
              <h1>
                오늘 점심,
                <br />
                <span>뭐 먹지?</span>
              </h1>
              <p>
                메뉴 고민은 여기까지.
                <br className="mobile-break" /> 지금 내 주변에서 딱 맞는 한 끼를
                찾아봐요.
              </p>
              <div className="hero-sticker" aria-hidden="true">
                <div className="plate">
                  <div className="egg">
                    <div />
                  </div>
                  <span className="leaf leaf-one" />
                  <span className="leaf leaf-two" />
                  <span className="tomato" />
                  <span className="grain g1" />
                  <span className="grain g2" />
                  <span className="grain g3" />
                </div>
                <span className="sticker-text">
                  a little less thinking,
                  <br />a little more eating.
                </span>
                <span className="spark spark-one">✳</span>
                <span className="spark spark-two">✧</span>
              </div>
            </section>
            <section className="mode-grid" aria-label="추천 방식 선택">
              <button
                className="mode-card survey-card"
                onClick={() => {
                  setView("survey");
                  setMode("survey");
                  setRadius(500);
                  setError("");
                }}
                disabled={waiting}
              >
                <div className="card-top">
                  <span className="card-kicker">내 취향을 담아서</span>
                  <span className="mode-icon">
                    <SlidersHorizontal size={23} />
                  </span>
                </div>
                <h2>
                  취향대로
                  <br />
                  골라주세요
                </h2>
                <p>
                  간단한 질문에 답하면
                  <br />
                  마음에 들 만한 3곳을 추천해요.
                </p>
                <div className="card-bottom">
                  <span>
                    맞춤 추천 시작하기 <ArrowRight size={18} />
                  </span>
                  <span className="time-label">약 20초</span>
                </div>
              </button>
              <button
                className="mode-card random-card"
                onClick={() => start("random")}
                disabled={waiting}
              >
                <div className="card-top">
                  <span className="card-kicker">고민도 선택도 없이</span>
                  <span className="mode-icon">
                    <Shuffle size={23} />
                  </span>
                </div>
                <h2>
                  그냥 아무거나
                  <br />
                  골라주세요
                </h2>
                <p>
                  오늘의 점심은 운명에 맡겨요.
                  <br />
                  가까운 곳 중 딱 한 곳을 골라드릴게요.
                </p>
                <div className="card-bottom">
                  <span>
                    {waiting ? "주변을 살펴보는 중" : "랜덤으로 뽑기"}{" "}
                    {waiting ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <ArrowRight size={18} />
                    )}
                  </span>
                  <span className="time-label">바로 추천</span>
                </div>
              </button>
            </section>
            <div className="trust-line">
              <span>
                <Check size={14} /> 가입 없이 바로
              </span>
              <i />
              <span>
                <MapPin size={14} /> 내 주변 음식점
              </span>
              <i />
              <span>
                <Utensils size={14} /> 점심 고민 끝
              </span>
            </div>
            <section className="how-section">
              <div>
                <span className="section-label">HOW IT WORKS</span>
                <h3>맛있는 결정까지, 세 걸음.</h3>
              </div>
              <div className="steps">
                <div>
                  <span>01</span>
                  <p>지금 있는 곳을 알려줘요</p>
                </div>
                <div>
                  <span>02</span>
                  <p>취향대로, 또는 랜덤으로</p>
                </div>
                <div>
                  <span>03</span>
                  <p>마음에 드는 곳으로 출발!</p>
                </div>
              </div>
            </section>
          </>
        )}
        {view === "survey" && (
          <section className="flow-section">
            <button className="back" onClick={goHome} disabled={waiting}>
              <ChevronLeft size={17} />
              처음으로
            </button>
            <div className="eyebrow">A LUNCH THAT FEELS LIKE YOU</div>
            <h1 className="flow-title">오늘은 어떤 한 끼?</h1>
            <p className="subtitle">
              끌리는 것만 골라주세요. 나머지는 저희가 찾을게요.
            </p>
            <div className="survey-panel">
              <fieldset>
                <legend>
                  <span>01</span> 얼마나 걸어갈까요?
                </legend>
                <div className="chips">
                  {[300, 500, 1000].map((r) => (
                    <button
                      key={r}
                      aria-pressed={radius === r}
                      onClick={() => setRadius(r)}
                      disabled={waiting}
                      className={radius === r ? "chip active" : "chip"}
                    >
                      {r === 1000 ? "1km" : r + "m"}
                    </button>
                  ))}
                </div>
                <p className="hint">직선거리 기준이에요.</p>
              </fieldset>
              <fieldset>
                <legend>
                  <span>02</span> 어떤 음식이 당기나요?
                  <small>여러 개 선택 가능</small>
                </legend>
                <div className="chips">
                  <button
                    disabled={waiting}
                    className={!cats.length ? "chip active" : "chip"}
                    aria-pressed={!cats.length}
                    onClick={() => setCats([])}
                  >
                    아무거나 좋아요
                  </button>
                  {categories.map(([code, label, emoji]) => (
                    <button
                      disabled={waiting}
                      className={cats.includes(code) ? "chip active" : "chip"}
                      aria-pressed={cats.includes(code)}
                      key={code}
                      onClick={() => toggle(cats, code, setCats)}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <span>03</span> 어떤 식사를 원하세요?
                </legend>
                <div className="chips">
                  {styles.map(([code, label]) => (
                    <button
                      disabled={waiting}
                      key={code}
                      aria-pressed={style === code}
                      className={style === code ? "chip active" : "chip"}
                      onClick={() => setStyle(code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <span>04</span> 오늘 피하고 싶은 음식은?
                  <small>선택 사항</small>
                </legend>
                <div className="chips">
                  {exclusions.map(([code, label]) => (
                    <button
                      disabled={waiting}
                      key={code}
                      aria-pressed={exclude.includes(code)}
                      className={
                        exclude.includes(code) ? "chip active" : "chip"
                      }
                      onClick={() => toggle(exclude, code, setExclude)}
                    >
                      {exclude.includes(code) && <Check size={14} />} {label}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  음식점 분류로 걸러드려요. 실제 재료와 메뉴는 확인이 필요해요.
                </p>
              </fieldset>
            </div>
            <button
              className="primary full"
              disabled={waiting}
              onClick={() => start("survey")}
            >
              {waiting ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  {locating
                    ? "현재 위치를 확인하고 있어요"
                    : "어울리는 음식점을 찾고 있어요"}
                </>
              ) : (
                <>
                  내 점심 추천받기 <ArrowRight size={18} />
                </>
              )}
            </button>
          </section>
        )}
        {view === "results" && reply && (
          <section className="flow-section results-section">
            <button className="back" disabled={waiting} onClick={goHome}>
              <ChevronLeft size={17} />
              처음으로
            </button>
            <div className="eyebrow">
              {mode === "random"
                ? "LEAVE LUNCH TO A LITTLE LUCK"
                : "YOUR LUNCH SHORTLIST"}
            </div>
            <div className="result-heading">
              <h1 className="flow-title">
                {reply.restaurants.length
                  ? shared
                    ? "함께 보는 점심 추천"
                    : mode === "random"
                      ? "오늘은 여기 어때요?"
                      : "오늘의 점심 후보예요"
                  : reply.exhausted
                    ? "한 바퀴 다 둘러봤어요"
                    : "조금만 다르게 찾아볼까요?"}
              </h1>
              {reply.restaurants.length > 0 && (
                <button
                  className="secondary share-button"
                  disabled={waiting || sharing}
                  onClick={shareRecommendation}
                >
                  {sharing ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Share2 size={16} />
                  )}
                  공유하기
                </button>
              )}
            </div>
            <p className="subtitle">
              {shared ? "공유된 추천" : location?.name} · 반경{" "}
              {radius === 1000 ? "1km" : radius + "m"}
              {mode === "random" ? " · 무작위 추천" : " · 설문 맞춤 추천"}
            </p>
            {shared && (
              <p className="shared-note">
                공유한 사람이 받은 추천이에요. 거리는 추천 당시 위치 기준이에요.
              </p>
            )}
            {shareMessage && (
              <p className="share-message" role="status">
                {shareMessage}
              </p>
            )}
            {manualShareUrl && (
              <div className="manual-share">
                <label htmlFor="recommendation-share-url">추천 공유 링크</label>
                <input
                  id="recommendation-share-url"
                  readOnly
                  value={manualShareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            )}
            {!reply.restaurants.length ? (
              <div className="empty-state">
                <Search size={34} />
                <h3>
                  {reply.exhausted
                    ? "이번 조건의 후보를 모두 보여드렸어요."
                    : "조건에 맞는 음식점을 찾지 못했어요."}
                </h3>
                <p>
                  {reply.exhausted
                    ? "처음부터 다시 뽑거나 이동거리를 넓혀보세요."
                    : "다른 음식 종류를 선택하거나 이동거리를 넓혀보세요."}
                </p>
              </div>
            ) : (
              <div
                className={
                  "results-grid " + (mode === "random" ? "single" : "")
                }
              >
                {reply.restaurants.map((p, i) => (
                  <article
                    key={p.id}
                    className={
                      "restaurant-card " + (selected === p.id ? "selected" : "")
                    }
                  >
                    <div className="restaurant-top">
                      <span className="food-emoji">
                        {categories.find((c) => c[1] === p.category)?.[2] ||
                          "🍽️"}
                      </span>
                      <span className="result-number">
                        {mode === "random" ? (
                          <Shuffle size={18} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                    </div>
                    <div className="restaurant-category">
                      {p.category} · {p.foodType}
                    </div>
                    <h2>{p.name}</h2>
                    <span className="distance">
                      <MapPin size={14} />{" "}
                      {shared ? "추천 당시 직선거리" : "직선거리"} 약{" "}
                      {p.distanceMeters}m
                    </span>
                    <div className="reason">
                      <Sparkles size={15} />
                      <p>{p.reason}</p>
                    </div>
                    <p className="address">{p.address}</p>
                    <button
                      className="primary"
                      onClick={() => setSelected(p.id)}
                    >
                      {selected === p.id ? (
                        <>
                          <Check size={17} />
                          오늘 점심으로 선택했어요
                        </>
                      ) : (
                        <>
                          이걸로 먹기 <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                    <a
                      className="map-link"
                      href={p.placeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      카카오맵에서 보기 <ArrowUpRight size={15} />
                    </a>
                  </article>
                ))}
              </div>
            )}
            {selected && (
              <p className="selection-message" role="status">
                좋아요, 맛있는 점심 드세요! 방문 전 영업 여부를 확인해 주세요.
              </p>
            )}
            <div className="result-actions">
              {shared ? (
                <button className="secondary" onClick={goHome}>
                  내 주변에서 새로 추천받기 <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button
                    className="secondary"
                    disabled={waiting}
                    onClick={() =>
                      location && recommend(mode, location, reply.exhausted)
                    }
                  >
                    {waiting ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Shuffle size={17} />
                    )}{" "}
                    {reply.exhausted
                      ? "처음부터 다시 뽑기"
                      : mode === "random"
                        ? "다시 뽑기"
                        : "다른 곳 추천"}
                  </button>
                  {mode === "survey" ? (
                    <button
                      className="secondary"
                      disabled={waiting}
                      onClick={() => {
                        setView("survey");
                        setError("");
                      }}
                    >
                      조건 변경 <SlidersHorizontal size={16} />
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      disabled={waiting}
                      onClick={() => {
                        const r =
                          radius < 1000 ? 1000 : radius < 3000 ? 3000 : 500;
                        setRadius(r);
                        if (location) void recommend(mode, location, true, r);
                      }}
                    >
                      반경{" "}
                      {radius < 1000 ? "1km" : radius < 3000 ? "3km" : "500m"}로
                      변경
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="notices">
              {reply.notices.map((n) => (
                <p key={n}>{n}</p>
              ))}
              {mode === "survey" &&
                reply.restaurants.length > 0 &&
                reply.restaurants.length < 3 && (
                  <p>
                    조건에 맞는 후보가 적어 {reply.restaurants.length}곳만
                    추천했어요.
                  </p>
                )}
            </div>
          </section>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="오류 닫기">
              <X size={16} />
            </button>
          </div>
        )}
      </main>
      <footer>
        <span className="footer-brand">오머먹.</span>
        <p>고민은 짧게, 점심은 맛있게.</p>
        <span className="footer-note">장소 정보 제공 · Kakao</span>
      </footer>
      {locationOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!locating) {
              pending.current = null;
              setLocationOpen(false);
            }
          }}
        >
          <section
            className="location-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <h2 id="location-title">어디에서 드시나요?</h2>
              <button
                disabled={locating}
                aria-label="닫기"
                onClick={() => {
                  pending.current = null;
                  setLocationOpen(false);
                }}
              >
                <X size={21} />
              </button>
            </div>
            <p>현재 위치나 주소·역 이름으로 찾아보세요.</p>
            <button
              className="secondary full"
              disabled={locating}
              onClick={() => gps(pending.current)}
            >
              {locating ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <LocateFixed size={17} />
              )}
              현재 위치 사용하기
            </button>
            <form
              className="search-form"
              onSubmit={(e) => {
                e.preventDefault();
                void searchLocation();
              }}
            >
              <input
                autoFocus
                aria-label="주소 또는 역 이름"
                placeholder="예: 성수역, 판교역, 도로명 주소"
                value={query}
                maxLength={100}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                disabled={searching || !query.trim()}
                aria-label="장소 검색"
              >
                {searching ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Search size={18} />
                )}
              </button>
            </form>
            {locationError && (
              <p className="modal-error" role="alert">
                {locationError}
              </p>
            )}
            <div className="location-results">
              {locations.map((l) => (
                <button
                  disabled={locating}
                  key={l.id}
                  onClick={() => chooseLocation(l)}
                >
                  <MapPin size={18} />
                  <span>
                    <strong>{l.name}</strong>
                    <small>{l.address}</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
              {searched && !locations.length && (
                <p className="hint">
                  검색 결과가 없어요. 다른 주소나 장소 이름을 입력해 주세요.
                </p>
              )}
            </div>
            <p className="privacy-note">
              위치는 주변 검색에만 사용하고 저장하지 않아요.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
