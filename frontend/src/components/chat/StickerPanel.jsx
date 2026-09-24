import { Heart, PackageOpen, Clock3, ImagePlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'

export default function StickerPanel({ onClose, onSend, disabled = false }) {
  const [data, setData] = useState({ packs: [], favorites: [], recent: [] })
  const [tab, setTab] = useState('recent')
  const [packId, setPackId] = useState('')
  const [error, setError] = useState('')
  const [imageDraft, setImageDraft] = useState(null)
  const [savingImage, setSavingImage] = useState(false)
  useEffect(() => { api.get('/stickers').then(({ data: result }) => { setData(result); setPackId(result.packs[0]?.id || '') }).catch(() => setError('Stickers could not be loaded.')) }, [])
  useEffect(() => () => { if (imageDraft?.url) URL.revokeObjectURL(imageDraft.url) }, [imageDraft?.url])
  const all = useMemo(() => Object.fromEntries(data.packs.flatMap(pack => pack.stickers.map(id => {
    const custom = data.customStickers?.find(item => item.id === id)
    return [id, custom || { id, url: `/stickers/${id}.svg`, packId: pack.id }]
  }))), [data.packs, data.customStickers])
  const visible = tab === 'recent' ? data.recent : tab === 'favorites' ? data.favorites : (data.packs.find(pack => pack.id === packId)?.stickers || [])
  const toggleFavorite = async id => {
    const favorite = !data.favorites.includes(id)
    const { data: result } = await api.post(`/stickers/${id}/favorite`, { favorite })
    setData(current => ({ ...current, favorites: result.favorites }))
  }
  const send = async id => {
    if (disabled) return
    try {
      await onSend(id)
      setData(current => ({ ...current, recent: [id, ...current.recent.filter(item => item !== id)].slice(0, 20) }))
      onClose()
    } catch (cause) { setError(cause.message || 'Unable to send sticker.') }
  }
  const createSticker = async () => {
    if (!imageDraft || savingImage) return
    setSavingImage(true)
    setError('')
    const form = new FormData()
    form.append('image', imageDraft.file)
    try {
      const { data: result } = await api.post('/stickers/custom', form)
      const customStickers = [result.sticker, ...(data.customStickers || []).filter(item => item.id !== result.sticker.id)]
      const customPack = { id: 'my-stickers', name: 'My stickers', cover: customStickers[0].url, stickers: customStickers.map(item => item.id) }
      setData(current => ({ ...current, packs: [...current.packs.filter(pack => pack.id !== 'my-stickers'), customPack], customStickers, favorites: [...new Set([...current.favorites, result.sticker.id])] }))
      setPackId('my-stickers')
      setTab('packs')
      setImageDraft(null)
    } catch (cause) { setError(cause.response?.data?.message || cause.message || 'Unable to create sticker.') }
    finally { setSavingImage(false) }
  }
  return <section className="sticker-panel" aria-label="Sticker picker">
    <header className="sticker-panel-header"><div><strong>Stickers</strong><span>Little moments, ready to send</span></div><div className="sticker-header-actions"><label className="sticker-add-photo"><ImagePlus size={15}/><span>Add photo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { if (file.size > 10 * 1024 * 1024) setError('Images must be 10 MB or smaller.'); else { setError(''); setImageDraft({ file, url: URL.createObjectURL(file) }) } } }}/></label><button type="button" className="icon-button" onClick={onClose} aria-label="Close stickers"><X size={17}/></button></div></header>
    <nav className="sticker-tabs" aria-label="Sticker collections">
      <button type="button" className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}><Clock3 size={15}/>Recent</button>
      <button type="button" className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}><Heart size={15}/>Favorites</button>
      <button type="button" className={tab === 'packs' ? 'active' : ''} onClick={() => setTab('packs')}><PackageOpen size={15}/>Packs</button>
    </nav>
    {tab === 'packs' && <div className="sticker-pack-tabs">{data.packs.map(pack => <button type="button" key={pack.id} className={pack.id === packId ? 'active' : ''} onClick={() => setPackId(pack.id)}>{pack.name}</button>)}</div>}
    {error && <p className="sticker-error" role="status">{error}</p>}
    {imageDraft && <div className="sticker-image-draft"><img src={imageDraft.url} alt="Square sticker crop preview"/><div><strong>Square sticker crop</strong><span>We’ll center-crop and optimize this image.</span></div><button type="button" onClick={createSticker} disabled={savingImage}>{savingImage ? 'Saving…' : 'Create sticker'}</button><button type="button" className="sticker-draft-cancel" onClick={() => setImageDraft(null)} disabled={savingImage} aria-label="Cancel sticker creation"><X size={16}/></button></div>}
    <div className="sticker-grid">{visible.map(id => all[id] && <div className="sticker-tile" key={id}><button type="button" className="sticker-send" onClick={() => send(id)} disabled={disabled} aria-label={`Send ${id} sticker`}><img src={all[id].url} alt="" loading="lazy"/></button><button type="button" className={`sticker-favorite ${data.favorites.includes(id) ? 'saved' : ''}`} onClick={() => toggleFavorite(id)} aria-label={data.favorites.includes(id) ? 'Remove from favorites' : 'Save to favorites'}><Heart size={14} fill={data.favorites.includes(id) ? 'currentColor' : 'none'}/></button></div>)}</div>
    {!visible.length && !error && <p className="sticker-empty">{tab === 'favorites' ? 'Save a sticker you love to find it here.' : tab === 'recent' ? 'Stickers you send will appear here.' : 'This pack is empty.'}</p>}
  </section>
}
