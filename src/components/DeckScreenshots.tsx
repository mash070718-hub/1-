import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Expand, Trash2, X } from 'lucide-react';
import { readScreenshot, uploadScreenshot } from '../lib/cloud';
import { MAX_DECK_SCREENSHOTS, prepareScreenshot, type DeckScreenshot } from '../lib/screenshots';
import { useAdminAccess } from './AdminAccess';
import './deck-screenshots.css';

function ScreenshotImage({ image, index }: { image: DeckScreenshot; index: number }) {
  const admin = useAdminAccess();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl(''); setError('');
    readScreenshot(image.path, admin).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : '사진을 불러오지 못했습니다.'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image.path, admin, attempt]);
  const label = `데미지 스크린샷 ${index + 1}`;
  const close = () => dialog.current?.close();
  return <>
    {error ? <div className="screenshot-load-error" role="status"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setAttempt(old => old + 1)}>사진 다시 불러오기</button></div>
      : <button type="button" className="screenshot-preview" disabled={!url} aria-label={`${label} 크게 보기`} onClick={() => { setZoom(false); dialog.current?.showModal(); }}>
        {url ? <img src={url} alt={label} width={image.width} height={image.height} decoding="async" onError={() => setError('이미지를 표시하지 못했습니다. 다시 불러와 주세요.')} /> : <span>사진 불러오는 중…</span>}
        <span className="screenshot-expand"><Expand size={16} /> 크게 보기</span>
      </button>}
    <dialog ref={dialog} className="screenshot-viewer" aria-label={`${label} 확대`} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); close(); }}>
      <div className="screenshot-viewer-toolbar"><strong>{label}</strong><button type="button" className="secondary-button" onClick={() => setZoom(old => !old)}>{zoom ? '화면에 맞추기' : '사진 크기로 확대'}</button><button type="button" className="icon-button" aria-label="사진 닫기" onClick={close}><X size={20} /></button></div>
      <div className={`screenshot-viewer-image ${zoom ? 'is-zoomed' : ''}`}>{url && <img src={url} alt={image.caption || label} width={image.width} height={image.height} />}</div>
      {image.caption && <p className="screenshot-viewer-caption">{image.caption}</p>}
    </dialog>
  </>;
}

export function DeckScreenshotGallery({ screenshots = [] }: { screenshots?: DeckScreenshot[] }) {
  if (!screenshots.length) return null;
  return <section className="detail-section" aria-label="거울던전 데미지 기록">
    <h3 className="detail-section-title"><Camera size={17} /> 데미지 기록</h3>
    <p className="field-help">직접 플레이한 결과입니다. 사진을 누르면 크게 볼 수 있습니다.</p>
    <div className="deck-screenshots-grid">{screenshots.map((image, index) => <figure className="deck-screenshot" key={image.path}>
      <ScreenshotImage image={image} index={index} />
      {image.caption && <figcaption>{image.caption}</figcaption>}
    </figure>)}</div>
  </section>;
}

export function DeckScreenshotEditor({ deckId, screenshots = [], onChange, onBusyChange }: {
  deckId: string;
  screenshots?: DeckScreenshot[];
  onChange: (screenshots: DeckScreenshot[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const latest = useRef({ screenshots, onChange, onBusyChange });
  latest.current = { screenshots, onChange, onBusyChange };
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const add = async (files: File[]) => {
    if (!files.length || busyRef.current) return;
    setError('');
    if (latest.current.screenshots.length + files.length > MAX_DECK_SCREENSHOTS) {
      setError('스크린샷은 덱마다 최대 3장까지 첨부할 수 있습니다. 남은 장수에 맞춰 선택해 주세요.');
      return;
    }
    busyRef.current = true; setBusy(true); latest.current.onBusyChange(true);
    try {
      for (const file of files) {
        const { blob, width, height } = await prepareScreenshot(file);
        if (!alive.current) return;
        const path = `mirror-decks/${deckId}/${crypto.randomUUID()}.webp`;
        await uploadScreenshot(path, blob);
        if (!alive.current) return;
        const next = [...latest.current.screenshots, { path, width, height, caption: '' }];
        latest.current.screenshots = next;
        latest.current.onChange(next);
        // Preserve successful uploads if a later file fails; only the unsaved draft changes.
      }
    } catch (error) {
      if (alive.current) setError(error instanceof Error ? error.message : '사진 업로드에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      busyRef.current = false;
      if (alive.current) { setBusy(false); latest.current.onBusyChange(false); }
    }
  };
  return <section className="form-field field-wide screenshot-editor" aria-label="데미지 스크린샷 첨부">
    <h3 className="field-label"><Camera size={17} /> 데미지 스크린샷 <span>{screenshots.length} / 3장</span></h3>
    <p className="field-help">직접 플레이한 결과를 최대 3장까지 올릴 수 있습니다. 기록 저장 후 게시하면 방문자도 볼 수 있습니다.</p>
    <div className="deck-screenshots-grid">{screenshots.map((image, index) => <div className="deck-screenshot" key={image.path}>
      <ScreenshotImage image={image} index={index} />
      <label className="form-field"><span className="field-label">사진 {index + 1} 설명</span><input className="input" type="text" lang="ko" inputMode="text" maxLength={300} value={image.caption} disabled={busy}
        placeholder="예: 15층 · 출혈 기프트 완성 · 총 피해량" onChange={event => onChange(screenshots.map(item => item.path === image.path ? { ...item, caption: event.currentTarget.value } : item))} /></label>
      <button type="button" className="secondary-button" disabled={busy} aria-label={`사진 ${index + 1} 첨부 제거`} onClick={() => onChange(screenshots.filter(item => item.path !== image.path))}><Trash2 size={14} /> 첨부 제거</button>
    </div>)}</div>
    <label className="field-label" htmlFor={inputId}>스크린샷 파일 선택</label>
    <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy || screenshots.length >= MAX_DECK_SCREENSHOTS} onChange={event => {
      const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; void add(files);
    }} />
    <p className="field-help">PNG·JPG·WebP, 원본 한 장당 20MB 이하. 사진은 읽기 좋은 크기로 자동 조정됩니다.</p>
    {busy && <p role="status">사진을 준비하고 업로드하고 있습니다. 완료될 때까지 잠시 기다려 주세요.</p>}
    {error && <div className="screenshot-error" role="alert"><p>{error}</p><a href="./SCREENSHOT_SETUP.html" target="_blank" rel="noreferrer">처음 첨부하거나 권한 오류가 나면 사진 저장소 설정 안내</a></div>}
  </section>;
}
