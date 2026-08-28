import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiAdminListUsers, apiAdminCreateUser, apiAdminUpdateUser, apiAdminDeleteUser, apiAdminResetPassword, apiAdminGetStorage, apiAdminListSessions, apiAdminRevokeSession, apiAdminGetAuditLog } from '../api'
import { timeAgo } from '../utils'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import UserAvatar from '../components/UserAvatar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import '../styles/account.css'
import '../styles/admin.css'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i]
}

export default function AdminPage() {
  const showToast = useToast()
  const { t } = useI18n()
  const { user: me } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await apiAdminListUsers())
    } catch (err) {
      showToast(t('admin.err.' + err.message, {}))
    }
    setLoading(false)
  }, [t])

  useEffect(() => { loadUsers() }, [])

  const q = searchQuery.toLowerCase()
  const filtered = q ? users.filter(u =>
    u.username.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) : users

  function handleErr(err) {
    const msg = t('admin.err.' + err.message)
    showToast(msg.startsWith('admin.err.') ? err.message : msg)
  }

  const tabs = [
    { key: 'users', label: t('admin.tabs.users') },
    { key: 'storage', label: t('admin.tabs.storage') },
    { key: 'sessions', label: t('admin.tabs.sessions') },
    { key: 'audit', label: t('admin.tabs.audit') },
  ]

  return (
    <div className="deck-page">
      <div className="container admin-container">
        <div className="header">
          <div className="header-left">
            <Link to="/" className="admin-back" title={t('sidebar.allDecks')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </Link>
            <h1>{t('admin.title')}
            {/* <span>{users.length}</span> */}
            </h1>
          </div>
          <div className="header-right">
            {tab === 'users' && <button className="create-header-btn" onClick={() => setCreateOpen(true)}>{t('admin.addUser')}</button>}
            <UserAvatar />
          </div>
        </div>

        <div className="admin-tabs">
          {tabs.map(tb => (
            <button key={tb.key} className={'admin-tab' + (tab === tb.key ? ' active' : '')}
              onClick={() => setTab(tb.key)}>{tb.label}</button>
          ))}
        </div>

        {tab === 'users' && (
          <>
            <div className="search-bar">
              <span className="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
              <input type="text" placeholder={t('admin.searchPlaceholder')} spellCheck="false"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('admin.user')}</th>
                    <th>{t('admin.role')}</th>
                    <th>{t('admin.decks')}</th>
                    <th>{t('admin.lastLogin')}</th>
                    <th className="admin-col-actions">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}><td colSpan="5"><div className="skeleton" style={{ height: 32, borderRadius: '0.5rem' }} /></td></tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="5" className="admin-empty">{searchQuery ? t('admin.emptySearch', { query: searchQuery }) : t('admin.empty')}</td></tr>
                  ) : filtered.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="admin-user-cell">
                          <span className={'ua-avatar' + (u.role === 'admin' ? ' ua-admin' : '')}>{(u.username || '?').charAt(0).toUpperCase()}</span>
                          <div className="admin-user-info">
                            <span className="admin-user-name">
                              {u.username}
                              {me?.id === u.id && <span className="admin-you">({t('admin.you')})</span>}
                            </span>
                            <span className="admin-user-email">{u.email || t('account.noEmail')}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className={'admin-role-badge' + (u.role === 'admin' ? ' is-admin' : '')}>{u.role === 'admin' ? t('admin.role.admin') : t('admin.role.user')}</span></td>
                      <td>{u.deckCount ?? 0}</td>
                      <td>{u.lastLogin ? timeAgo(u.lastLogin) : t('admin.never')}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button className="admin-action-btn" title={t('common.rename')}
                            onClick={() => setEditTarget(u)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                          </button>
                          <button className="admin-action-btn" title={t('admin.resetPassword')}
                            onClick={() => setResetTarget(u)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </button>
                          <button className="admin-action-btn danger" disabled={me?.id === u.id}
                            title={me?.id === u.id ? t('admin.cannotDeleteSelf') : t('common.delete')}
                            style={me?.id === u.id ? { opacity: 0.35, cursor: 'default' } : {}}
                            onClick={() => { if (me?.id !== u.id) setDeleteTarget(u) }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'storage' && <StorageTab />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'audit' && <AuditTab />}
      </div>

      {createOpen && (
        <UserFormModal
          onClose={() => setCreateOpen(false)}
          onError={handleErr}
          onSaved={() => { setCreateOpen(false); showToast(t('admin.userCreated'), 'success'); loadUsers() }} />
      )}

      {editTarget && (
        <UserFormModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onError={handleErr}
          onSaved={() => { setEditTarget(null); showToast(t('admin.userSaved'), 'success'); loadUsers() }} />
      )}

      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onError={handleErr}
          onSaved={() => { setResetTarget(null); showToast(t('admin.passwordResetDone'), 'success') }} />
      )}

      <ConfirmDialog
        show={!!deleteTarget}
        message={t('admin.deleteConfirm', { name: deleteTarget?.username || '' })}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const target = deleteTarget
          setDeleteTarget(null)
          try {
            await apiAdminDeleteUser(target.id)
            showToast(t('admin.userDeleted'), 'success')
            loadUsers()
          } catch (err) { handleErr(err) }
        }} />
    </div>
  )
}

function StorageTab() {
  const { t } = useI18n()
  const showToast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try { setData(await apiAdminGetStorage()) }
      catch (err) { showToast(t('admin.err.' + err.message)) }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="admin-loading"><div className="skeleton" style={{ height: 120, borderRadius: '0.5rem' }} /></div>
  if (!data || !data.users?.length) return <div className="admin-empty">{t('admin.storage.noData')}</div>

  return (
    <div className="admin-section">
      <div className="admin-summary-row">
        <div className="admin-summary-card">
          <span className="admin-summary-label">{t('admin.storage.total')}</span>
          <span className="admin-summary-value">{formatBytes(data.total?.storageBytes || 0)}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-label">{t('admin.tabs.storage')}</span>
          <span className="admin-summary-value">{data.total?.images || 0}</span>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.storage.user')}</th>
              <th>{t('admin.storage.decks')}</th>
              <th>{t('admin.storage.images')}</th>
              <th>{t('admin.storage.size')}</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map(u => (
              <tr key={u.id}>
                <td className="admin-user-name">{u.username}</td>
                <td>{u.deckCount}</td>
                <td>{u.imageCount}</td>
                <td>{formatBytes(u.storageBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SessionsTab() {
  const { t } = useI18n()
  const showToast = useToast()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setSessions(await apiAdminListSessions()) }
    catch (err) { showToast(t('admin.err.' + err.message)) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  async function revoke(token) {
    try {
      await apiAdminRevokeSession(token)
      showToast(t('admin.sessions.revoked'), 'success')
      load()
    } catch (err) { showToast(err.message) }
  }

  if (loading) return <div className="admin-loading"><div className="skeleton" style={{ height: 120, borderRadius: '0.5rem' }} /></div>
  if (!sessions.length) return <div className="admin-empty">{t('admin.sessions.noSessions')}</div>

  return (
    <div className="admin-section">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.sessions.user')}</th>
              <th>{t('admin.sessions.token')}</th>
              <th>{t('admin.sessions.created')}</th>
              <th>{t('admin.sessions.expires')}</th>
              <th className="admin-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={i}>
                <td className="admin-user-name">{s.username || '—'}</td>
                <td className="admin-token">{s.token}</td>
                <td>{timeAgo(s.created)}</td>
                <td>{timeAgo(s.expires)}</td>
                <td>
                  <button className="admin-action-btn danger" title={t('admin.sessions.revoke')}
                    onClick={() => revoke(s.token)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditTab() {
  const { t } = useI18n()
  const showToast = useToast()
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      const data = await apiAdminGetAuditLog(50, offset)
      setEntries(prev => offset === 0 ? data.entries : [...prev, ...data.entries])
      setTotal(data.total)
    } catch (err) { showToast(t('admin.err.' + err.message)) }
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => { load() }, [])

  if (loading) return <div className="admin-loading"><div className="skeleton" style={{ height: 120, borderRadius: '0.5rem' }} /></div>
  if (!entries.length) return <div className="admin-empty">{t('admin.audit.noEntries')}</div>

  return (
    <div className="admin-section">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.audit.time')}</th>
              <th>{t('admin.audit.user')}</th>
              <th>{t('admin.audit.action')}</th>
              <th>{t('admin.audit.detail')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td className="admin-audit-time">{timeAgo(e.created)}</td>
                <td className="admin-user-name">{e.username || '—'}</td>
                <td><span className="admin-audit-badge">{e.action}</span></td>
                <td className="admin-audit-detail">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length < total && (
        <div className="admin-load-more">
          <button className="admin-load-more-btn" onClick={() => load(entries.length)}
            disabled={loadingMore}>
            {loadingMore ? t('common.loading') : t('admin.audit.loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}

function RoleSelect({ value, onChange }) {
  const { t } = useI18n()
  return (
    <select className="account-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="user">{t('admin.role.user')}</option>
      <option value="admin">{t('admin.role.admin')}</option>
    </select>
  )
}

function UserFormModal({ user, onClose, onSaved, onError }) {
  const { t } = useI18n()
  const showToast = useToast()
  const isEdit = !!user
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role || 'user')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!username.trim()) { showToast(t('auth.needUsername')); return }
    if (!isEdit && password.length < 6) { showToast(t('auth.passwordShort')); return }
    setSaving(true)
    try {
      if (isEdit) {
        await apiAdminUpdateUser(user.id, { username: username.trim(), email: email.trim(), role })
      } else {
        await apiAdminCreateUser({ username: username.trim(), password, email: email.trim(), role })
      }
      onSaved()
    } catch (err) {
      onError(err)
    }
    setSaving(false)
  }

  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => e.stopPropagation()}>
      <div className="confirm-box account-modal">
        <p>{isEdit ? t('admin.editUserTitle', { name: user.username }) : t('admin.createUserTitle')}</p>
        <label className="account-label">{t('auth.username')}</label>
        <input type="text" className="prompt-input" value={username} spellCheck="false" autoFocus
          onChange={e => setUsername(e.target.value)} />
        {!isEdit && (<>
          <label className="account-label">{t('auth.password')}</label>
          <input type="text" className="prompt-input" value={password}
            placeholder={t('auth.passwordPlaceholder')}
            onChange={e => setPassword(e.target.value)} />
        </>)}
        <label className="account-label">{t('auth.email')} {t('auth.optional')}</label>
        <input type="email" className="prompt-input" value={email} spellCheck="false"
          placeholder={t('auth.emailPlaceholder')} onChange={e => setEmail(e.target.value)} />
        <label className="account-label">{t('admin.role')}</label>
        <RoleSelect value={role} onChange={setRole} />
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn-save account-btn-save" onClick={save} disabled={saving}>
            {saving ? t('common.loading') : (isEdit ? t('common.save') : t('admin.createUserBtn'))}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({ target, onClose, onSaved, onError }) {
  const { t } = useI18n()
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (newPassword.length < 6) return
    setSaving(true)
    try {
      await apiAdminResetPassword(target.id, newPassword)
      onSaved()
    } catch (err) {
      onError(err)
    }
    setSaving(false)
  }

  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => e.stopPropagation()}>
      <div className="confirm-box account-modal">
        <p>{t('admin.resetPasswordFor', { name: target.username })}</p>
        <label className="account-label">{t('account.newPassword')}</label>
        <input type="text" className="prompt-input" value={newPassword} autoFocus
          placeholder={t('auth.passwordPlaceholder')} onChange={e => setNewPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newPassword.length >= 6) save(); if (e.key === 'Escape') onClose() }} />
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn-save account-btn-save" onClick={save} disabled={saving || newPassword.length < 6}
            style={{ opacity: newPassword.length >= 6 ? 1 : 0.5 }}>
            {saving ? t('common.loading') : t('admin.resetPasswordBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}
