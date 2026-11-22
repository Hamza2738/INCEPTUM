import { useEffect } from "react";

export function useFonts(lang) {
  useEffect(() => {
    if (lang === "ar") {
      import("@fontsource/noto-naskh-arabic/400.css");
      import("@fontsource/noto-naskh-arabic/600.css");
      import("@fontsource/noto-sans-arabic/400.css");
      import("@fontsource/noto-sans-arabic/600.css");
    }
    if (lang === "ja") {
      import("@fontsource/noto-serif-jp/400.css");
      import("@fontsource/noto-serif-jp/600.css");
      import("@fontsource/noto-sans-jp/400.css");
      import("@fontsource/noto-sans-jp/600.css");
    }
  }, [lang]);
}
