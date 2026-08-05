import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import translations from './translations'

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

let currentLang = 'en'

function applyLang(lang) {
  currentLang = lang
  document.documentElement.setAttribute('lang', lang)
  document.documentElement.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr')
  document.title = (translations[lang] && translations[lang]['app.title']) || translations.en['app.title']
  try {
    localStorage.setItem('appLang', lang)
  } catch (_) {}
}

function readStoredLang() {
  let lang = 'en'
  try {
    const saved = localStorage.getItem('appLang')
    if (saved === 'fa' || saved === 'en') lang = saved
  } catch (_) {}
  return lang
}

export function getLang() {
  return currentLang
}

export function formatDigits(value) {
  return String(value).replace(/[0-9]/g, d => FA_DIGITS[+d])
}

export function n(value) {
  return currentLang === 'fa' ? formatDigits(value) : String(value)
}

export function t(key, params) {
  let template = translations[currentLang] && translations[currentLang][key]
  if (template == null) template = translations.en[key] || key
  if (!params) return template
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v)),
    template
  )
}

const I18nContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const initial = readStoredLang()
    applyLang(initial)
    return initial
  })

  useEffect(() => {
    applyLang(lang)
  }, [lang])

  const setLang = useCallback((next) => {
    setLangState(next === 'fa' ? 'fa' : 'en')
  }, [])

  const value = {
    lang,
    setLang,
    t: (key, params) => t(key, params),
    n,
    isRtl: lang === 'fa'
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
