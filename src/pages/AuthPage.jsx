import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import LanguageSwitch from '../components/LanguageSwitch'
import '../styles/auth.css'

export default function AuthPage() {
  const { user, ready, login, register } = useAuth()
  const { t, isRtl } = useI18n()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to="/" replace />

  function authError(code) {
    const key = 'auth.err.' + code
    const translated = t(key)
    return translated === key ? (code || t('auth.failed')) : translated
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const name = username.trim()
    if (!name) { setError(t('auth.needUsername')); return }
    if (!password) { setError(t('auth.needPassword')); return }
    if (mode === 'register') {
      if (password.length < 6) { setError(t('auth.passwordShort')); return }
      if (password !== confirm) { setError(t('auth.passwordMismatch')); return }
    }
    setBusy(true)
    try {
      if (mode === 'register') await register(name, password, email.trim())
      else await login(name, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(authError(err.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={'auth-page' + (isRtl ? ' rtl' : '')}>
      <div className="auth-bg">
        <div className="auth-blob b1" />
        <div className="auth-blob b2" />
        <div className="auth-blob b3" />
        <div className="auth-grid" />
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <svg className="auth-brand-icon" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            <polygon points="9 12 9 8 13 10 9 12" fill="#818cf8" stroke="none" />
          </svg>
          <h1>{t('app.title')}</h1>
          <p className="auth-tagline">{t('auth.tagline')}</p>
        </div>

        <div className="auth-tabs">
          <button className={'auth-tab' + (mode === 'login' ? ' active' : '')} onClick={() => switchMode('login')}>
            {t('auth.login')}
          </button>
          <button className={'auth-tab' + (mode === 'register' ? ' active' : '')} onClick={() => switchMode('register')}>
            {t('auth.register')}
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{t('auth.username')}</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={mode === 'register' ? t('auth.usernamePlaceholder') : t('auth.usernameLogin')}
              spellCheck="false"
              autoComplete="username"
            />
          </label>

          {mode === 'register' && (
            <label className="auth-field">
              <span>{t('auth.email')} <em>{t('auth.optional')}</em></span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                spellCheck="false"
                autoComplete="email"
              />
            </label>
          )}

          <label className="auth-field">
            <span>{t('auth.password')}</span>
            <div className="auth-pw-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? t('auth.passwordPlaceholder') : t('auth.passwordLogin')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button type="button" className="auth-eye" tabIndex="-1" onClick={() => setShowPw(v => !v)} title={showPw ? t('auth.hide') : t('auth.show')}>
                {showPw
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
          </label>

          {mode === 'register' && (
            <label className="auth-field">
              <span>{t('auth.confirmPassword')}</span>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder={t('auth.confirmPlaceholder')}
                autoComplete="new-password"
              />
            </label>
          )}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? <span className="auth-spinner" /> : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? t('auth.noAccount', { action: '' }) + ' ' : t('auth.haveAccount', { action: '' }) + ' '}
          <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? t('auth.signUpNow') : t('auth.signInNow')}
          </button>
        </p>

        <div className="auth-footer">
          <span className="auth-copyright">{t('app.footer', { year: new Date().getFullYear() })}</span>
          <LanguageSwitch />
        </div>
      </div>
    </div>
  )
}