import { Language } from "./interface";

// Define cache interface
interface TranslationCache {
  [key: string]: {
    [targetLang: string]: string;
  };
}

// Single session-wide cache instance
const sessionCache: TranslationCache = {};

// Add a type for translation context
type TranslationContext = "name" | "general" | "month";

export const translateText = async (
  text: string,
  targetLang: Language,
  context: TranslationContext = "general"
): Promise<string> => {
  // Check session cache
  if (sessionCache[text]?.[targetLang]) {
    return sessionCache[text][targetLang];
  }

  // At this point, we need to call the API - log the translation request

  // Proceed with API translation if not cached
  const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (!API_KEY) {
    console.error("No API key found");
    return text;
  }

  try {
    // Log the full request details
    const requestBody = {
      q: text,
      target: targetLang,
      source: "he",
    };

    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: "http://localhost:3005/",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API Error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(
        `HTTP error! status: ${response.status}, body: ${errorText}`
      );
    }

    const data = await response.json();
    const translatedText = data.data.translations[0].translatedText;

    // Store in session cache
    if (!sessionCache[text]) {
      sessionCache[text] = {};
    }
    sessionCache[text][targetLang] = translatedText;

    return translatedText;
  } catch (error) {
    console.error("Translation failed:", error);
    return text;
  }
};
