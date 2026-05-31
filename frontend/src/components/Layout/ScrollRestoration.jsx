import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Скролл наверх только при смене страницы (pathname).
 * Смена query (?categoryId=, фильтры) и пагинация без смены маршрута — позицию не трогаем.
 */
export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPathnameRef = useRef(location.pathname);
  const scrollPositionsRef = useRef(new Map());

  useLayoutEffect(() => {
    const pathnameChanged = previousPathnameRef.current !== location.pathname;
    previousPathnameRef.current = location.pathname;

    if (navigationType === "POP") {
      const savedY = scrollPositionsRef.current.get(location.key);
      if (typeof savedY === "number") {
        window.scrollTo({ top: savedY, left: 0, behavior: "auto" });
      }
      return;
    }

    if (pathnameChanged) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [location.key, location.pathname, navigationType]);

  useLayoutEffect(() => {
    return () => {
      scrollPositionsRef.current.set(location.key, window.scrollY);
    };
  }, [location.key]);

  return null;
}
