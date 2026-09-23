import { ImagePlus, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStories } from '../../context/StoryContext'

export default function StoryComposer({ onClose }) {
  const { publishStory } = useStories()
  const [media, setMedia] = useState(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState('friends')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])
  const chooseMedia = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm|quicktime)$/.test(file.type)) return setError('Choose a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.')
    if (file.size > 20 * 1024 * 1024) return setError('Stories are limited to 20 MB.')
    if (preview) URL.revokeObjectURL(preview)
    setMedia(file); setPreview(URL.createObjectURL(file)); setError('')
  }
  const submit = async event => {
    event.preventDefault()
    if (!media) return setError('Choose media for your story.')
    setBusy(true); setError('')
    try { await publishStory({ media, caption, visibility }); onClose() } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to publish your story.') } finally { setBusy(false) }
  }
  return <div className="story-layer" onClick={() => !busy && onClose()}><form className="story-composer" onSubmit={submit} onClick={event => event.stopPropagation()}><div className="story-composer-heading"><div><h2>Add story</h2><p>Available for 24 hours.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>{preview ? <div className="story-preview">{media.type.startsWith('video/') ? <video src={preview} controls /> : <img src={preview} alt="Story preview" />}</div> : <label className="story-upload"><ImagePlus size={22}/><span>Choose an image or short video</span><small>Up to 20 MB · videos up to 60 seconds</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={chooseMedia}/></label>}<label className="field"><span>Caption (optional)</span><textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength="280" rows="3" /></label><fieldset className="story-visibility"><legend>Who can view this story?</legend><label><input type="radio" name="story-visibility" value="friends" checked={visibility === 'friends'} onChange={event => setVisibility(event.target.value)} /> Friends only</label><label><input type="radio" name="story-visibility" value="public" checked={visibility === 'public'} onChange={event => setVisibility(event.target.value)} /> Everyone</label></fieldset>{error && <p className="inline-error">{error}</p>}<div className="story-composer-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Publishing…' : <><Send size={16}/> Publish</>}</button></div></form></div>
}
