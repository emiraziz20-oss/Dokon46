import React, { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo("Ro'yxatdan o'tdingiz. Endi kirishingiz mumkin.")
        setMode('signin')
      }
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark">O</div>
          <div>
            <div className="login-title">OptoBoard</div>
            <div className="login-sub">Ulgurji savdo boshqaruvi</div>
          </div>
        </div>

        <h2>{mode === 'signin' ? 'Tizimga kirish' : "Ro'yxatdan o'tish"}</h2>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="siz@misol.com" />
          </label>
          <label>
            Parol
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="kamida 6 ta belgi" />
          </label>

          {error && <div className="login-error">{error}</div>}
          {info && <div className="login-info">{info}</div>}

          <button type="submit" className="btn-primary full" disabled={loading}>
            {loading ? 'Kuting...' : mode === 'signin' ? 'Kirish' : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <button className="login-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}>
          {mode === 'signin' ? "Akkountingiz yo'qmi? Ro'yxatdan o'ting" : 'Akkountingiz bormi? Kiring'}
        </button>
      </div>

      <style>{`
        .login-screen {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #0f1320; font-family: 'Inter', sans-serif; padding: 20px;
        }
        .login-card { background: #fff; border-radius: 18px; padding: 32px; width: 100%; max-width: 380px; }
        .login-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
        .login-mark { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .login-title { font-weight: 700; font-size: 15px; }
        .login-sub { font-size: 11.5px; color: #8a8f98; }
        .login-card h2 { font-size: 18px; margin: 0 0 18px; }
        .login-form { display: flex; flex-direction: column; gap: 14px; }
        .login-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: #4b5563; }
        .login-form input { padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; }
        .login-form input:focus { border-color: #2563eb; }
        .btn-primary.full { width: 100%; margin-top: 4px; background: #2563eb; color: #fff; border: none; padding: 11px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary.full:disabled { background: #c7d2fe; }
        .login-error { background: #fee2e2; color: #dc2626; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; }
        .login-info { background: #dcfce7; color: #16a34a; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; }
        .login-switch { margin-top: 18px; width: 100%; background: none; border: none; color: #2563eb; font-size: 12.5px; font-weight: 600; cursor: pointer; }
      `}</style>
    </div>
  )
}
