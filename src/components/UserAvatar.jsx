import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { resolveUrl, uploadImage, apiUpdateProfile, apiChangePassword } from '../api'
import { useToast } from './Toast'
import '../styles/account.css'

function AvatarCircle({ user, size }) {
  const url = user?.avatar ? resolveUrl(user.avatar) : ''
  const initial = (user?.username || '?').charAt(0).toUpperCase()
  return (
    <span className={'ua-avatar' + (size ? ' ua-' + size : '')}>
      {url
        ? <img src={url} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
        : <span className="ua-initial">{initial}</span>}
    </span>
  )
}

export default function UserAvatar({ className = '' }) {
  const navigate = useNavigate()
  const showToast = useToast()
  const { t } = useI18n()
  const { user, logout, updateUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    try { await logout() } catch (_) {}
    navigate('/auth', { replace: true })
  }

  function openMenu() {
    setMenuOpen(v => !v)
  }

  return (
    <div className={'ua-wrap' + (className ? ' ' + className : '')} ref={wrapRef}>
      <button className="ua-trigger" onClick={openMenu}
        title={t('auth.signedInAs', { name: user?.username || '' })}
        aria-label={t('account.profile')}>
        <AvatarCircle user={user} />
      </button>

      {menuOpen && (
        <div className="ua-menu">
          <div className="ua-menu-head">
            <AvatarCircle user={user} size="lg" />
            <div className="ua-menu-head-info">
              <span className="ua-menu-name">{user?.username}</span>
              <span className="ua-menu-email">{user?.email || t('account.noEmail')}</span>
            </div>
          </div>
          <button className="ua-menu-item" onClick={() => { setMenuOpen(false); setProfileOpen(true) }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {t('account.profile')}
          </button>
          <button className="ua-menu-item" onClick={() => { setMenuOpen(false); setPasswordOpen(true) }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            {t('account.changePassword')}
          </button>
          {user?.role === 'admin' && (
            <button className="ua-menu-item" onClick={() => { setMenuOpen(false); navigate('/admin') }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {t('admin.title')}
            </button>
          )}
          <button className="ua-menu-item" onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            {t('settings.global')}
          </button>
          <div className="ua-divider"></div>
          <button className="ua-menu-item ua-danger" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {t('auth.logout')}
          </button>
        </div>
      )}

      {profileOpen && (
        <EditProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onSaved={(u) => { updateUser(u); showToast(t('account.profileSaved'), 'success') }} />
      )}

      {passwordOpen && (
        <ChangePasswordModal
          onClose={() => setPasswordOpen(false)}
          onSaved={() => showToast(t('account.passwordChanged'), 'success')} />
      )}

      {settingsOpen && (
        <GlobalSettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}

function GlobalSettingsModal({ onClose }) {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => e.stopPropagation()}>
      <div className="confirm-box account-modal">
        <p>{t('settings.global')}</p>
        <label className="account-label">{t('settings.language')}</label>
        <div className="lang-picker" style={{ marginBottom: '1rem' }}>
          <button className={'lang-pick' + (lang === 'fa' ? ' active' : '')}
            onClick={() => setLang('fa')}>{t('lang.fa')}</button>
          <button className={'lang-pick' + (lang === 'en' ? ' active' : '')}
            onClick={() => setLang('en')}>{t('lang.en')}</button>
        </div>
        <label className="account-label">{t('settings.theme')}</label>
        <div className="lang-picker" style={{ marginBottom: '1rem' }}>
          <button className={'lang-pick' + (theme === 'dark' ? ' active' : '')}
            onClick={() => setTheme('dark')}>{t('settings.themeDark')}</button>
          <button className={'lang-pick' + (theme === 'light' ? ' active' : '')}
            onClick={() => setTheme('light')}>{t('settings.themeLight')}</button>
        </div>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose}>{t('common.done')}</button>
        </div>
      </div>
    </div>
  )
}

function EditProfileModal({ user, onClose, onSaved }) {
  const { t } = useI18n()
  const showToast = useToast()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ? resolveUrl(user.avatar) : '')
  const [avatarDataUrl, setAvatarDataUrl] = useState(undefined)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  function pickFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target.result
      setAvatarDataUrl(dataUrl)
      setAvatarPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function removeAvatar() {
    setAvatarDataUrl(null)
    setAvatarPreview('')
  }

  async   function save() {
    if (!username.trim()) { showToast(t('auth.needUsername')); return }
    setSaving(true)
    try {
      let avatarParam
      if (avatarDataUrl === undefined) avatarParam = undefined
      else if (avatarDataUrl === null) avatarParam = ''
      else avatarParam = avatarDataUrl
      const updated = await apiUpdateProfile({
        username: username.trim(),
        email: email.trim(),
        ...(avatarParam !== undefined ? { avatar: avatarParam } : {})
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      const msg = t('account.err.' + err.message)
      showToast(msg.startsWith('account.err.') ? err.message : msg)
    }
    setSaving(false)
  }

  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => e.stopPropagation()}>
      <div className="confirm-box account-modal">
        <p>{t('account.profile')}</p>
        <div className="account-avatar-row">
          <div className="account-avatar-preview">
            {avatarPreview
              ? <img src={avatarPreview} alt="" />
              : <span className="account-avatar-initial">{(username || '?').charAt(0).toUpperCase()}</span>}
          </div>
          <div className="account-avatar-btns">
            <button type="button" className="account-btn-secondary" onClick={() => fileRef.current?.click()}>{t('account.uploadAvatar')}</button>
            {avatarPreview && <button type="button" className="account-btn-danger-text" onClick={removeAvatar}>{t('account.removeAvatar')}</button>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />
          </div>
        </div>
        <label className="account-label">{t('auth.username')}</label>
        <input type="text" className="prompt-input" value={username} spellCheck="false"
          onChange={e => setUsername(e.target.value)} autoFocus />
        <label className="account-label">{t('auth.email')} {t('auth.optional')}</label>
        <input type="email" className="prompt-input" value={email} spellCheck="false"
          placeholder={t('auth.emailPlaceholder')} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }} />
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn-save account-btn-save" onClick={save} disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordModal({ onClose, onSaved }) {
  const { t } = useI18n()
  const showToast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!currentPassword) { showToast(t('auth.needPassword')); return }
    if (newPassword.length < 6) { showToast(t('auth.passwordShort')); return }
    if (newPassword !== confirmPassword) { showToast(t('auth.passwordMismatch')); return }
    setSaving(true)
    try {
      await apiChangePassword(currentPassword, newPassword)
      onSaved()
      onClose()
    } catch (err) {
      const msg = t('account.err.' + err.message)
      showToast(msg.startsWith('account.err.') ? err.message : msg)
    }
    setSaving(false)
  }

  const inputType = showPw ? 'text' : 'password'

  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => e.stopPropagation()}>
      <div className="confirm-box account-modal">
        <p>{t('account.changePassword')}</p>
        <label className="account-label">{t('account.currentPassword')}</label>
        <input type={inputType} className="prompt-input" value={currentPassword}
          autoComplete="current-password"
          onChange={e => setCurrentPassword(e.target.value)} autoFocus />
        <label className="account-label">{t('account.newPassword')}</label>
        <input type={inputType} className="prompt-input" value={newPassword}
          autoComplete="new-password" placeholder={t('auth.passwordPlaceholder')}
          onChange={e => setNewPassword(e.target.value)} />
        <label className="account-label">{t('auth.confirmPassword')}</label>
        <input type={inputType} className="prompt-input" value={confirmPassword}
          autoComplete="new-password" placeholder={t('auth.confirmPlaceholder')}
          onChange={e => setConfirmPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }} />
        <label className="account-show-pw">
          <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />
          {showPw ? t('auth.hide') : t('auth.show')}
        </label>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn-save account-btn-save" onClick={save} disabled={saving}>
            {saving ? t('common.loading') : t('account.changePasswordBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}
