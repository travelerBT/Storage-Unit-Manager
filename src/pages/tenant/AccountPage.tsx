import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/lib/services'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { User } from 'lucide-react'

export function AccountPage() {
  const { firebaseUser, appUser } = useAuth()
  const [displayName, setDisplayName] = useState(appUser?.displayName ?? '')
  const [phone, setPhone] = useState(appUser?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!firebaseUser) return
    setSaving(true)
    try {
      await usersService.update(firebaseUser.uid, { displayName, phone })
      setProfileMsg('Profile updated.')
    } catch {
      setProfileMsg('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!firebaseUser || !firebaseUser.email) return
    if (newPwd !== confirmPwd) { setPwdMsg('Passwords do not match.'); return }
    if (newPwd.length < 6) { setPwdMsg('Password must be at least 6 characters.'); return }
    setPwdSaving(true)
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPwd)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(getAuth().currentUser!, newPwd)
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setPwdMsg('Password changed successfully.')
    } catch {
      setPwdMsg('Failed to change password. Check your current password.')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-2">
        <User className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Account</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={firebaseUser?.email ?? ''} disabled />
            </div>
            <div className="space-y-1">
              <Label>Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1">
              <Label>Current Password</Label>
              <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </div>
            {pwdMsg && <p className="text-sm text-muted-foreground">{pwdMsg}</p>}
            <Button type="submit" disabled={pwdSaving}>{pwdSaving ? 'Updating...' : 'Update Password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
