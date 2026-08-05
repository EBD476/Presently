import React from 'react'
import { useI18n } from '../i18n'

export default function LanguageSwitch({ className }) {
  const { lang, setLang, t } = useI18n()
  const isRtl = lang === 'fa'
  return (
    <button
      className={'lang-switch' + (className ? ' ' + className : '')}
      onClick={() => setLang(isRtl ? 'en' : 'fa')}
      title={isRtl ? t('lang.en') : t('lang.fa')}
      aria-label={isRtl ? t('lang.switchToEn') : t('lang.switchToFa')}
    >
      {isRtl ? 'EN' : 'FA'}
    </button>
  )
}
