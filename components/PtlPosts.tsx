import React from 'react';
import { supabase } from '../lib/supabaseClient';

type PostSection = 'news' | 'tales';
export interface PtlPost {
  id: string;
  section: PostSection;
  title: string;
  body: string;
  image_path: string | null;
  image_alt: string | null;
  is_pinned: boolean;
  published_at: string;
}

interface PtlPostsProps {
  section: PostSection;
  canEdit: boolean;
  userId: string;
}

const excerpt = (body: string, length = 160) =>
  body.length > length ? `${body.slice(0, length).trimEnd()}…` : body;
const postExcerptLength = 160;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const emptyDraft = { title: '', body: '', image_alt: '' };
const maxImageBytes = 10 * 1024 * 1024;

export function PtlPosts({ section, canEdit, userId }: PtlPostsProps) {
  const [posts, setPosts] = React.useState<PtlPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState(emptyDraft);
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const [removeCurrentImage, setRemoveCurrentImage] = React.useState(false);
  const [openPost, setOpenPost] = React.useState<PtlPost | null>(null);
  const [saving, setSaving] = React.useState(false);

  const imageUrl = (path: string | null) => path
    ? supabase.storage.from('ptl-post-images').getPublicUrl(path).data.publicUrl
    : '';

  const loadPosts = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ptl_posts').select('*').eq('section', section).order('is_pinned', { ascending: false }).order('published_at', { ascending: false });
    if (error) setNotice('Posts are not available yet. Run supabase/ptl_posts.sql first.');
    else setPosts((data || []) as PtlPost[]);
    setLoading(false);
  }, [section]);

  React.useEffect(() => { loadPosts(); }, [loadPosts]);

  const startEdit = (post?: PtlPost) => {
    setNotice('');
    setEditingId(post?.id || 'new');
    setDraft(post ? { title: post.title, body: post.body, image_alt: post.image_alt || '' } : emptyDraft);
    setSelectedImage(null);
    setRemoveCurrentImage(false);
  };

  const savePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) return;
    setSaving(true);
    setNotice('');
    const values = {
      section,
      title: draft.title.trim(),
      body: draft.body.trim(),
      image_alt: draft.image_alt.trim() || null,
      updated_by: userId,
      ...(removeCurrentImage && !selectedImage ? { image_path: null } : {}),
    };
    const result = editingId === 'new'
      ? await supabase.from('ptl_posts').insert({ ...values, created_by: userId }).select().single()
      : await supabase.from('ptl_posts').update(values).eq('id', editingId).select().single();
    if (result.error) setNotice(result.error.message);
    else {
      const savedPost = result.data as PtlPost;
      if (selectedImage) await uploadImage(savedPost, selectedImage);
      if (removeCurrentImage && !selectedImage && editingPost?.image_path) {
        const { error } = await supabase.storage.from('ptl-post-images').remove([editingPost.image_path]);
        if (error) setNotice(`Post saved, but the old photo could not be removed: ${error.message}`);
      }
      setEditingId(null);
      setDraft(emptyDraft);
      setSelectedImage(null);
      setRemoveCurrentImage(false);
      await loadPosts();
    }
    setSaving(false);
  };

  const uploadImage = async (post: PtlPost, file: File) => {
    setNotice('');
    if (!file.type.startsWith('image/')) { setNotice('Please choose an image file.'); return; }
    if (file.size > maxImageBytes) { setNotice('Photos must be 10 MB or smaller.'); return; }
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const path = `${userId}/${post.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('ptl-post-images').upload(path, file, { upsert: false });
    if (uploadError) { setNotice(uploadError.message); return; }
    const { error } = await supabase.from('ptl_posts').update({ image_path: path, updated_by: userId }).eq('id', post.id);
    if (error) {
      await supabase.storage.from('ptl-post-images').remove([path]);
      setNotice(error.message);
    } else {
      if (post.image_path) await supabase.storage.from('ptl-post-images').remove([post.image_path]);
      await loadPosts();
    }
  };

  const removeImage = async (post: PtlPost) => {
    if (!post.image_path) return;
    setNotice('');
    const { error: removeError } = await supabase.storage.from('ptl-post-images').remove([post.image_path]);
    if (removeError) { setNotice(removeError.message); return; }
    const { error } = await supabase.from('ptl_posts').update({ image_path: null, updated_by: userId }).eq('id', post.id);
    if (error) setNotice(error.message); else await loadPosts();
  };

  const togglePin = async (post: PtlPost) => {
    setNotice('');
    const { error } = await supabase.from('ptl_posts')
      .update({ is_pinned: !post.is_pinned, updated_by: userId })
      .eq('id', post.id);
    if (error) setNotice(`Could not ${post.is_pinned ? 'unpin' : 'pin'} post: ${error.message}`);
    else await loadPosts();
  };

  const deletePost = async (post: PtlPost) => {
    if (!window.confirm('Remove this post?')) return;
    if (post.image_path) await supabase.storage.from('ptl-post-images').remove([post.image_path]);
    const { error } = await supabase.from('ptl_posts').delete().eq('id', post.id);
    if (error) setNotice(error.message); else await loadPosts();
  };

  const editingPost = editingId && editingId !== 'new'
    ? posts.find((post) => post.id === editingId)
    : undefined;

  const renderPostActions = (post: PtlPost) => canEdit && <div className="ptl-post-actions">
    <button className="text-action" type="button" onClick={() => togglePin(post)}>{post.is_pinned ? 'Unpin' : 'Pin to top'}</button>
    <button className="text-action" type="button" onClick={() => startEdit(post)}>Edit</button>
    <label className="upload-action">{post.image_path ? 'Replace picture' : 'Upload picture'}<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadImage(post, file); event.currentTarget.value = ''; }} /></label>
    {post.image_path && <button className="text-action danger-action" type="button" onClick={() => removeImage(post)}>Remove picture</button>}
    <button className="text-action danger-action" type="button" onClick={() => deletePost(post)}>Delete post</button>
  </div>;

  return <>
    {canEdit && <div className="ptl-editor-tools">
      <button className="secondary-action" type="button" onClick={() => startEdit()}>Add {section === 'news' ? 'news' : 'tale'}</button>
    </div>}
    {editingId && <form className="ptl-editor" onSubmit={savePost}>
      <label>Title<input value={draft.title} maxLength={140} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>Post text<textarea value={draft.body} maxLength={5000} rows={4} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
      {editingPost?.image_path && <div className="ptl-editor-photo">
        {!removeCurrentImage && <img src={imageUrl(editingPost.image_path)} alt={editingPost.image_alt || editingPost.title} />}
        {removeCurrentImage
          ? <><span>Current photo will be removed when you save.</span><button className="text-action" type="button" onClick={() => setRemoveCurrentImage(false)}>Keep photo</button></>
          : <button className="text-action danger-action" type="button" onClick={() => setRemoveCurrentImage(true)}>Remove current photo</button>}
      </div>}
      <label>Photo <span>(optional, JPG/PNG/WebP/GIF up to 10 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
        const file = event.target.files?.[0] || null;
        if (file && (!file.type.startsWith('image/') || file.size > maxImageBytes)) {
          setNotice('Photos must be 10 MB or smaller.');
          event.currentTarget.value = '';
          setSelectedImage(null);
          return;
        }
        setNotice('');
        setSelectedImage(file);
      }} /></label>
      {selectedImage && <p className="ptl-selected-image">Selected photo: {selectedImage.name}</p>}
      <label>Image description <span>(optional)</span><input value={draft.image_alt} maxLength={200} onChange={(event) => setDraft({ ...draft, image_alt: event.target.value })} /></label>
      <div className="ptl-editor-actions"><button className="primary-action" disabled={saving}>{saving ? 'Saving…' : 'Save post'}</button><button className="text-action" type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
    </form>}
    {notice && <p className="ptl-notice" role="status">{notice}</p>}
    {openPost && <div className="ptl-reader-overlay" role="dialog" aria-modal="true" onClick={() => setOpenPost(null)}>
      <article className="ptl-reader" onClick={(event) => event.stopPropagation()}>
        <header className="ptl-reader-header">
          <span className="news-meta">{section === 'news' ? 'PTL NEWS' : 'TALES FROM THE TECH LAB'} · {formatDate(openPost.published_at)}</span>
          <button className="ptl-reader-close" onClick={() => setOpenPost(null)} aria-label="Close post">✕ Close</button>
        </header>
        {openPost.image_path && <img className="ptl-reader-image" src={imageUrl(openPost.image_path)} alt={openPost.image_alt || openPost.title} />}
        <h2 className="ptl-reader-title">{openPost.title}</h2>
        {openPost.body.split(/\n{2,}/).map((paragraph, index) => <p key={index} className="ptl-reader-body">{paragraph}</p>)}
      </article>
    </div>}
    {loading ? <p className="section-copy">Loading posts…</p> : posts.length === 0 ? <p className="section-copy">No posts yet.</p> : <div className={`ptl-post-list ptl-post-list-${section}`}>
        {posts.map((post, index) => <article className={`${section === 'news' ? 'news-card' : 'story-card'} ptl-post-card ${index === 0 ? 'ptl-featured' : ''}`} key={post.id}>
          <div className="news-meta">{section === 'news' ? 'LAB NOTE' : 'TALE'} · {formatDate(post.published_at)}</div>
          {post.is_pinned && <span className="ptl-pinned-label">Pinned</span>}
          {post.image_path && <img className={`ptl-post-image ${index === 0 ? 'ptl-featured-image' : ''}`} src={imageUrl(post.image_path)} alt={post.image_alt || post.title} />}
          <div className="ptl-post-content"><h3>{post.title}</h3><p>{excerpt(post.body, postExcerptLength)}</p>
            {post.body.length > postExcerptLength && <button className="ptl-read-more" onClick={() => setOpenPost(post)}>Read more →</button>}
            {renderPostActions(post)}
          </div>
        </article>)}
    </div>}
  </>;
}
