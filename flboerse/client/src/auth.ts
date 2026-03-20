export function getToken(): string | null {
  return localStorage.getItem('flboerse_token')
}

export function setToken(t: string): void {
  localStorage.setItem('flboerse_token', t)
}

export function clearToken(): void {
  localStorage.removeItem('flboerse_token')
}

export interface JwtPayload {
  id: number
  kuerzel: string
  vorname: string
  nachname: string
  is_admin: number
}

export function getUser(): JwtPayload | null {
  const token = getToken()
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload)) as JwtPayload
  } catch {
    return null
  }
}

export function isAdmin(): boolean {
  return getUser()?.is_admin === 1
}
