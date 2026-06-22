import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const SettingsContext = createContext<any>(null)

export const SettingsProvider = ({ children }: any) => {

  const [settings, setSettings] = useState<any>(null)

  const fetchSettings = async () => {
    try {
      const res = await api.get('/system/settings')

      if (res.success) {
        setSettings(res.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)