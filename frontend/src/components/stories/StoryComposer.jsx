import { ImagePlus, Send, Type, Video, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStories } from '../../context/StoryContext'

const acceptedMedia = /^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm|quicktime)$/

export default function StoryComposer({ onClose }) {
  const { publishStory } = useStories()
  const [kind, setKind] = useState('text')
  const [media, setMedia] = useState(null)
  const [preview, setPreview] = useState('')
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState('friends')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const chooseMedia = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!acceptedMedia.test(file.type)) { setError('Choose a supported image or video file.'); event.target.value = ''; return }
    if (file.size > 20 * 1024 * 1024) { setError('Media must be 20 MB or smaller.'); event.target.value = ''; return }
    if (preview) URL.revokeObjectURL(preview)
    setMedia(file)
    setPreview(URL.createObjectURL(file))
    setKind(file.type.startsWith('video/') ? 'video' : 'image')
    setError('')
  }

  const chooseKind = next => {
    setKind(next)
    setError('')
    if (next === 'text') { if (preview) URL.revokeObjectURL(preview); setPreview(''); setMedia(null) }
  }

  const submit = async event => {
    event.preventDefault()
    if (kind === 'text' && !text.trim()) return setError('Write something for your status.')
    if (kind !== 'text' && !media) return setError('Choose a photo or video first.')
    setBusy(true)
    setError('')
    try { await publishStory({ media, mediaType: kind, text: text.trim(), caption: caption.trim(), visibility }); onClose() }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Unable to post this status.') }
    finally { setBusy(false) }
  }

  return <div className="status-modal-layer" onClick={() => !busy && onClose()}>
    <form className="status-composer" onSubmit={submit} onClick={event => event.stopPropagation()}>
      <header className="status-composer-header"><div><span className="status-eyebrow">SHARE A MOMENT</span><h2>Create status</h2><p>Visible to your audience for 24 hours.</p></div><button type="button" className="status-icon-button" aria-label="Close" onClick={onClose} disabled={busy}><X size={19}/></button></header>
      <div className="status-kind-tabs" role="tablist" aria-label="Status type">
        <button type="button" role="tab" aria-selected={kind === 'text'} className={kind === 'text' ? 'active' : ''} onClick={() => chooseKind('text')}><Type size={16}/>Text</button>
        <button type="button" role="tab" aria-selected={kind === 'image'} className={kind === 'image' || kind === 'video' ? 'active' : ''} onClick={() => document.getElementById('status-media-input')?.click()}><ImagePlus size={16}/>Photo or video</button>
        <input id="status-media-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={chooseMedia}/>
      </div>
      <div className={`status-preview ${kind === 'text' ? 'text-preview' : ''}`}>
        {kind === 'text' ? <><span className="status-preview-label">PREVIEW</span><p>{text.trim() || 'Your status will look like this'}</p></> : preview ? kind === 'video' ? <video src={preview} controls playsInline preload="metadata" /> : <img src={preview} alt="Status preview" /> : <label className="status-upload-prompt" htmlFor="status-media-input"><ImagePlus size={27}/><strong>Add a photo or short video</strong><span>JPG, PNG, WebP, GIF, MP4, WebM or MOV · up to 20 MB</span></label>}
      </div>
      {kind === 'text' ? <label className="status-field"><span>Your message</span><textarea value={text} onChange={event => setText(event.target.value)} maxLength={1000} rows={3} placeholder="What's happening?" /></label> : <label className="status-field"><span>Caption <small>optional</small></span><textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={280} rows={2} placeholder="Add a caption…" /></label>}
      {kind !== 'text' && <button type="button" className="status-change-media" onClick={() => document.getElementById('status-media-input')?.click()}>{kind === 'video' ? <Video size={15}/> : <ImagePlus size={15}/>} {media ? 'Change media' : 'Choose media'}</button>}
      <fieldset className="status-audience"><legend>Share with</legend><label><input type="radio" name="status-visibility" value="friends" checked={visibility === 'friends'} onChange={() => setVisibility('friends')}/><span><strong>Friends</strong><small>People you’ve connected with</small></span></label><label><input type="radio" name="status-visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')}/><span><strong>Everyone</strong><small>Visible to all CONVO users</small></span></label></fieldset>
      {error && <p className="status-form-error" role="alert">{error}</p>}
      <footer className="status-composer-actions"><button type="button" className="status-cancel-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="status-post-button" disabled={busy}>{busy ? <span className="status-spinner"/> : <Send size={16}/>} {busy ? 'Posting…' : 'Post status'}</button></footer>
    </form>
  </div>
}
