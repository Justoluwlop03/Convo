import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { io } from 'socket.io-client';
import axios from 'axios';
import api, { setToken } from './src/api';

// Matches the frontend's default dark navy and blue theme.
const C = { ink: '#e5eefb', muted: '#a5b4cf', blue: '#3b82f6', pale: '#172a4a', bg: '#0b1220', surface: '#101827', line: '#27354d', red: '#f87171' };
const errorText = (error, fallback) => error.response?.data?.message || (error.code === 'ECONNABORTED' ? `The request timed out. Check that the API at ${api.defaults.baseURL} is reachable.` : error.code === 'ERR_NETWORK' ? `Could not connect to ${api.defaults.baseURL}. Check the API address and network.` : error.message || fallback);
const formatTime = value => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

function normalizeChat(chat, userId) {
  const other = chat.participants?.find(person => person.id !== userId) || chat.participants?.[0] || {};
  return { id: chat.id, name: other.displayName || other.username || 'Conversation', handle: other.username || '', avatar: other.avatar || '', online: Boolean(other.online), preview: chat.lastMessage?.text || 'Start a conversation', time: formatTime(chat.updatedAt), unreadCount: Number(chat.unreadCount) || 0 };
}

function normalizeMessage(message) {
  return { ...message, senderId: message.sender?.id || message.sender, time: formatTime(message.createdAt) };
}

export default function App() {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync('chat_token').then(async stored => {
      if (!stored) return;
      setToken(stored);
      try {
        const { data } = await api.get('/auth/me');
        if (alive) { setTokenState(stored); setUser(data.user); }
      } catch (error) {
        await SecureStore.deleteItemAsync('chat_token');
        setToken(null);
        if (alive) setSessionError(errorText(error, 'Your session expired. Please sign in again.'));
      }
    }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!token) { setSocket(null); return undefined; }
    const connection = io(api.defaults.baseURL.replace(/\/api\/?$/, ''), { auth: { token }, transports: ['websocket'] });
    setSocket(connection);
    return () => { connection.disconnect(); setSocket(null); };
  }, [token]);

  const establishSession = async result => {
    setToken(result.token);
    await SecureStore.setItemAsync('chat_token', result.token);
    setTokenState(result.token);
    setUser(result.user);
    setSessionError('');
  };
  const logout = async () => {
    await SecureStore.deleteItemAsync('chat_token').catch(() => {});
    setToken(null); setTokenState(null); setUser(null); setSessionError('');
  };

  if (loading) return <Centered><ActivityIndicator color={C.blue} size="large" /></Centered>;
  if (!token || !user) return <AuthScreen onSession={establishSession} initialError={sessionError} />;
  return <Home user={user} socket={socket} onLogout={logout} />;
}

function Centered({ children }) { return <SafeAreaView style={s.centered}>{children}</SafeAreaView>; }

function AuthScreen({ onSession, initialError }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false); const [checking, setChecking] = useState(false); const [error, setError] = useState(initialError || '');
  const checkApi = async () => {
    setChecking(true);
    const healthUrl = api.defaults.baseURL.replace(/\/api\/?$/, '/health');
    try { const { data } = await axios.get(healthUrl, { timeout: 7000 }); setError(`Backend connection works (${data.status || 'healthy'}). You can sign in.`); }
    catch (requestError) { setError(`Could not reach ${healthUrl} (${requestError.code || requestError.message}).`); }
    finally { setChecking(false); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const payload = mode === 'login' ? { email: email.trim(), password } : { email: email.trim(), password, username: username.trim() };
      const { data } = await api.post(`/auth/${mode}`, payload);
      await onSession(data);
    } catch (requestError) { setError(errorText(requestError, mode === 'login' ? 'Unable to sign in.' : 'Unable to create account.')); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={s.authSafe}><StatusBar barStyle="light-content" /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.authWrap}>
    <View style={s.brandMark}><Text style={s.brandLetter}>C</Text></View><Text style={s.brand}>Convo</Text><Text style={s.tagline}>Good conversations start here.</Text>
    <View style={s.form}><Text style={s.formTitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
      {mode === 'register' && <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="yourname" />}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="you@example.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
      {!!error && <View style={s.errorBox}><Text style={s.error}>{error}</Text><Pressable disabled={checking} onPress={checkApi} style={{ paddingVertical: 8 }}><Text style={s.modeStrong}>{checking ? 'Checking…' : 'Test connection'}</Text></Pressable></View>}
      <PrimaryButton title={busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} disabled={busy || !email || !password || (mode === 'register' && !username)} />
      <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} style={s.modeToggle}><Text style={s.modeText}>{mode === 'login' ? 'New to Convo?  ' : 'Already have an account?  '}<Text style={s.modeStrong}>{mode === 'login' ? 'Create account' : 'Sign in'}</Text></Text></Pressable>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}

function Home({ user, socket, onLogout }) {
  const [chats, setChats] = useState([]); const [selected, setSelected] = useState(null); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const refresh = async () => {
    setRefreshing(true);
    try { const { data } = await api.get('/chats'); setChats((data.chats || []).map(chat => normalizeChat(chat, user.id))); setError(''); }
    catch (requestError) { setError(errorText(requestError, 'Unable to load chats.')); }
    finally { setRefreshing(false); }
  };
  useEffect(() => { refresh(); }, []);
  if (selected) return <Conversation chat={selected} user={user} socket={socket} onBack={() => { setSelected(null); refresh(); }} />;
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" />
    <View style={s.header}><View><Text style={s.eyebrow}>YOUR SPACE</Text><Text style={s.title}>Messages</Text></View><Pressable onPress={onLogout} style={s.userChip}><Avatar name={user.displayName || user.username} uri={user.avatar} size={40} /><Text style={s.logout}>×</Text></Pressable></View>
    <View style={s.searchStub}><Text style={{ color: C.muted, fontSize: 17 }}>⌕</Text><Text style={s.searchHint}>Search conversations</Text></View>
    <View style={s.sectionHead}><Text style={s.sectionTitle}>Recent chats</Text><Text style={s.chatCount}>{chats.length}</Text></View>
    {error ? <Pressable onPress={refresh} style={s.errorBox}><Text style={s.error}>{error}  Tap to retry</Text></Pressable> : null}
    <FlatList data={chats} keyExtractor={item => item.id} refreshing={refreshing} onRefresh={refresh} contentContainerStyle={chats.length ? s.list : s.emptyList} ListEmptyComponent={!refreshing ? <View style={s.empty}><Text style={s.emptyIcon}>✳</Text><Text style={s.emptyTitle}>No conversations yet</Text><Text style={s.emptyText}>Add and accept a friend request in Convo to start chatting.</Text></View> : null} renderItem={({ item }) => <Pressable onPress={() => setSelected(item)} style={s.chatRow}><View style={s.avatarWrap}><Avatar name={item.name} uri={item.avatar} size={54} />{item.online && <View style={s.onlineDot} />}</View><View style={s.chatCopy}><View style={s.nameLine}><Text numberOfLines={1} style={s.chatName}>{item.name}</Text><Text style={s.chatTime}>{item.time}</Text></View><Text numberOfLines={1} style={s.chatPreview}>{item.preview}</Text></View></Pressable>} />
  </SafeAreaView>;
}

function Conversation({ chat, user, socket, onBack }) {
  const [messages, setMessages] = useState([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const listRef = useRef(null);
  const load = async () => { try { const { data } = await api.get(`/messages/${chat.id}`); setMessages((data.messages || []).map(normalizeMessage)); setError(''); } catch (requestError) { setError(errorText(requestError, 'Could not load messages.')); } };
  useEffect(() => {
    load();
    if (!socket) return undefined;
    socket.emit('join_chat', { chatId: chat.id });
    const onReceived = ({ message }) => {
      if (message?.chatId !== chat.id) return;
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, normalizeMessage(message)]);
    };
    socket.on('message_received', onReceived);
    return () => { socket.off('message_received', onReceived); socket.emit('leave_chat', { chatId: chat.id }); };
  }, [chat.id, socket]);
  const send = async () => {
    const clean = text.trim(); if (!clean || busy) return;
    setBusy(true); setText(''); setError('');
    try { const { data } = await api.post('/messages', { chatId: chat.id, text: clean }); const message = normalizeMessage(data.message); setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]); }
    catch (requestError) { setText(clean); setError(errorText(requestError, 'Message could not be sent.')); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" /><View style={s.convoHeader}><Pressable onPress={onBack} style={s.backButton}><Text style={s.backGlyph}>‹</Text></Pressable><Avatar name={chat.name} uri={chat.avatar} size={42} /><View style={{ flex: 1, marginLeft: 11 }}><Text numberOfLines={1} style={s.convoName}>{chat.name}</Text><Text style={s.convoStatus}>{chat.online ? 'Online' : `@${chat.handle}`}</Text></View><Text style={s.more}>•••</Text></View>
    {error ? <Pressable onPress={load} style={s.errorBox}><Text style={s.error}>{error}</Text></Pressable> : null}
    <FlatList ref={listRef} data={messages} keyExtractor={(item, index) => String(item.id || index)} contentContainerStyle={s.messageList} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })} ListEmptyComponent={<View style={s.empty}><Text style={s.emptyIcon}>✳</Text><Text style={s.emptyTitle}>Say hello to {chat.name.split(' ')[0]}</Text><Text style={s.emptyText}>This is the start of your conversation.</Text></View>} renderItem={({ item }) => { const own = String(item.senderId) === String(user.id); return <View style={[s.bubble, own ? s.ownBubble : s.theirBubble]}><Text style={[s.bubbleText, own && s.ownText]}>{item.text || (item.type === 'image' ? '📷 Image' : item.type === 'voice' ? '🎤 Voice message' : '')}</Text><Text style={[s.bubbleTime, own && s.ownTime]}>{item.time}</Text></View>; }} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.composer}><TextInput value={text} onChangeText={setText} placeholder="Write a message…" placeholderTextColor="#8fa1bd" style={s.composerInput} multiline maxLength={5000} onSubmitEditing={send} /><Pressable disabled={!text.trim() || busy} onPress={send} style={[s.sendButton, (!text.trim() || busy) && s.sendDisabled]}><Text style={s.sendGlyph}>{busy ? '…' : '↑'}</Text></Pressable></View></KeyboardAvoidingView>
  </SafeAreaView>;
}

function Avatar({ name, uri, size }) { const initials = (name || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); return <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>{uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <Text style={[s.avatarText, { fontSize: size * .3 }]}>{initials}</Text>}</View>; }
function Field({ label, ...props }) { return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput style={s.fieldInput} placeholderTextColor="#8fa1bd" {...props} /></View>; }
function PrimaryButton({ title, onPress, disabled }) { return <Pressable onPress={onPress} disabled={disabled} style={[s.primary, disabled && s.primaryDisabled]}><Text style={s.primaryText}>{title}</Text></Pressable>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }, authSafe: { flex: 1, backgroundColor: C.bg }, authWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 25, paddingVertical: 24 },
  brandMark: { width: 54, height: 54, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }, brandLetter: { color: '#fff', fontWeight: '800', fontSize: 36 }, brand: { color: C.ink, fontSize: 31, fontWeight: '800', textAlign: 'center', marginTop: 12, letterSpacing: -1 }, tagline: { color: C.muted, textAlign: 'center', fontSize: 14, marginTop: 5, marginBottom: 32 }, form: { backgroundColor: C.surface, padding: 23, borderRadius: 25, borderWidth: 1, borderColor: C.line }, formTitle: { color: C.ink, fontWeight: '750', fontSize: 22, marginBottom: 20 }, field: { marginBottom: 15 }, fieldLabel: { color: '#b6c5e1', fontSize: 12, fontWeight: '700', marginBottom: 7 }, fieldInput: { borderColor: C.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.ink, backgroundColor: C.bg }, primary: { backgroundColor: C.blue, borderRadius: 13, alignItems: 'center', paddingVertical: 15, marginTop: 6 }, primaryDisabled: { opacity: .55 }, primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 }, modeToggle: { paddingVertical: 17, alignItems: 'center' }, modeText: { color: C.muted, fontSize: 13 }, modeStrong: { color: '#7cc3ff', fontWeight: '700' }, error: { color: C.red, fontSize: 13, lineHeight: 19 }, errorBox: { paddingHorizontal: 23, paddingVertical: 9 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 23, paddingTop: 20, paddingBottom: 18 }, eyebrow: { color: '#7cc3ff', fontSize: 10, fontWeight: '800', letterSpacing: 2 }, title: { color: C.ink, fontSize: 30, fontWeight: '800', letterSpacing: -.8, marginTop: 5 }, userChip: { position: 'relative' }, logout: { position: 'absolute', width: 19, height: 19, lineHeight: 18, textAlign: 'center', right: -2, bottom: -1, backgroundColor: C.surface, borderRadius: 10, color: C.blue, fontWeight: '800', fontSize: 15 }, searchStub: { marginHorizontal: 22, marginBottom: 25, paddingHorizontal: 15, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 14, borderColor: C.line, borderWidth: 1 }, searchHint: { color: '#8fa1bd', fontSize: 14 }, sectionHead: { marginHorizontal: 24, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 9 }, sectionTitle: { fontSize: 16, color: C.ink, fontWeight: '750' }, chatCount: { fontSize: 11, fontWeight: '700', color: '#93c5fd', backgroundColor: C.pale, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden', borderRadius: 9 }, list: { paddingBottom: 25 }, emptyList: { flexGrow: 1, justifyContent: 'center' }, chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 15 }, avatarWrap: { position: 'relative' }, avatar: { backgroundColor: C.pale, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }, avatarText: { color: C.blue, fontWeight: '800' }, onlineDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#50bd82', borderWidth: 2, borderColor: C.bg, right: 0, bottom: 0 }, chatCopy: { flex: 1, marginLeft: 14, paddingBottom: 13, borderBottomColor: C.line, borderBottomWidth: 1 }, nameLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, chatName: { color: C.ink, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 }, chatTime: { color: '#91a0ba', fontSize: 11 }, chatPreview: { color: C.muted, fontSize: 13, marginTop: 5 }, empty: { alignItems: 'center', paddingHorizontal: 42, paddingVertical: 35 }, emptyIcon: { color: C.blue, fontSize: 31, marginBottom: 12 }, emptyTitle: { color: C.ink, fontWeight: '700', fontSize: 16, textAlign: 'center' }, emptyText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7 },
  convoHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, backgroundColor: C.surface, borderBottomColor: C.line, borderBottomWidth: 1 }, backButton: { width: 39, height: 45, justifyContent: 'center' }, backGlyph: { color: C.blue, fontSize: 37, marginTop: -5 }, convoName: { color: C.ink, fontSize: 15, fontWeight: '750' }, convoStatus: { color: C.muted, fontSize: 11, marginTop: 3 }, more: { color: C.blue, fontSize: 18, paddingHorizontal: 5 }, messageList: { paddingHorizontal: 17, paddingVertical: 18, flexGrow: 1, justifyContent: 'flex-end' }, bubble: { maxWidth: '82%', borderRadius: 19, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, marginVertical: 5 }, ownBubble: { backgroundColor: '#2563eb', alignSelf: 'flex-end', borderBottomRightRadius: 6 }, theirBubble: { backgroundColor: '#1e293b', alignSelf: 'flex-start', borderBottomLeftRadius: 6 }, bubbleText: { color: C.ink, fontSize: 15, lineHeight: 21 }, ownText: { color: '#fff' }, bubbleTime: { color: '#91a0ba', fontSize: 9, textAlign: 'right', marginTop: 4 }, ownTime: { color: '#dbeafe' }, composer: { backgroundColor: C.surface, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, borderTopColor: C.line, borderTopWidth: 1, gap: 9 }, composerInput: { flex: 1, maxHeight: 100, minHeight: 43, backgroundColor: C.bg, borderRadius: 15, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, fontSize: 14, color: C.ink }, sendButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: '#274273' }, sendGlyph: { color: '#fff', fontSize: 23, fontWeight: '700', marginTop: -3 },
});
