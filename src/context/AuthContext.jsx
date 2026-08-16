import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getToken, setToken, apiMe, apiLogin, apiRegister, apiLogout } from '../api'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const token = getToken()
    if (!token) {
      setReady(true)
      return
    }
    apiMe()
      .then(u => { if (!cancelled) setUser(u) })
      .catch(() => setToken(null))
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (username, password, email) => {
    const res = await apiRegister(username, password, email)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setToken(null)
    setUser(null)
  }, [])

  const value = { user, ready, login, register, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}