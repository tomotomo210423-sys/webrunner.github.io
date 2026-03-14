document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const fileInput = document.getElementById('file-input');
    const runBtn = document.getElementById('run-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const addFileBtn = document.getElementById('add-file-btn');
    const autorunToggle = document.getElementById('autorun-toggle');
    const editor = document.getElementById('editor');
    const previewFrame = document.getElementById('preview-frame');
    const fileTabsContainer = document.getElementById('file-tabs');
    const fileStatus = document.getElementById('file-status');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const previewSection = document.getElementById('preview-section');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const fsText = document.getElementById('fs-text');
    
    // --- カスタムアラート機能 ---
    const alertModal = document.getElementById('alert-modal');
    const alertMessage = document.getElementById('alert-message');
    const alertFooter = document.getElementById('alert-footer');

    function showAlert(message) {
        alertMessage.textContent = message;
        alertFooter.innerHTML = '<button id="alert-ok-btn" class="btn btn-primary">OK</button>';
        document.getElementById('alert-ok-btn').onclick = () => alertModal.classList.remove('active');
        alertModal.classList.add('active');
    }

    function showConfirm(message, onConfirm) {
        alertMessage.textContent = message;
        alertFooter.innerHTML = `
            <button id="alert-cancel-btn" class="btn btn-outline">キャンセル</button>
            <button id="alert-confirm-btn" class="btn btn-primary" style="background-color: var(--danger-color);">実行する</button>
        `;
        document.getElementById('alert-cancel-btn').onclick = () => alertModal.classList.remove('active');
        document.getElementById('alert-confirm-btn').onclick = () => {
            alertModal.classList.remove('active');
            onConfirm();
        };
        alertModal.classList.add('active');
    }

    // --- 状態管理 (オートセーブ機能) ---
    let fileStore = { 'index.html': { type: 'html', originalExt: 'html', content: '' } };
    let activeFileName = 'index.html';
    let autorunTimer = null;
    let lastCompiledHtml = '';

    // ロカルストレージからの復元
    const savedFiles = localStorage.getItem('wfr_files');
    const savedActive = localStorage.getItem('wfr_active');
    if (savedFiles) {
        try { fileStore = JSON.parse(savedFiles); } catch(e) { console.error("データ復元失敗"); }
    }
    if (savedActive && fileStore[savedActive]) {
        activeFileName = savedActive;
    }

    // 状態の保存関数
    function saveState() {
        localStorage.setItem('wfr_files', JSON.stringify(fileStore));
        localStorage.setItem('wfr_active', activeFileName);
    }

    // --- 自動言語判別機能 ---
    function getFileType(fileName) {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : 'txt';
    }

    // --- エディタ・タブ管理 ---
    function updateTabs(targetActiveName = null) {
        fileTabsContainer.innerHTML = '';
        const fileNames = Object.keys(fileStore);
        fileStatus.textContent = `${fileNames.length}個のファイル`;

        if (fileNames.length === 0) {
            activeFileName = null;
            editor.value = ''; editor.disabled = true;
            saveState();
            return;
        }

        editor.disabled = false;
        if (targetActiveName && fileStore[targetActiveName]) activeFileName = targetActiveName;
        else if (!activeFileName || !fileStore[activeFileName]) activeFileName = fileNames[0];
        
        fileNames.forEach(name => {
            const tab = document.createElement('div');
            tab.className = `file-tab ${name === activeFileName ? 'active' : ''}`;
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = name;
            titleSpan.title = "ダブルクリックで名前を変更";
            
            // タブ切り替え
            titleSpan.addEventListener('click', () => updateTabs(name));
            
            // 【新機能】リネーム（ダブルクリック）
            titleSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const newName = prompt('新しいファイル名を入力してください:', name);
                if (newName && newName.trim() !== '' && newName !== name) {
                    if (fileStore[newName]) {
                        showAlert('同じ名前のファイルが既に存在します。');
                        return;
                    }
                    fileStore[newName] = fileStore[name];
                    delete fileStore[name];
                    if (activeFileName === name) activeFileName = newName;
                    saveState(); updateTabs(); triggerAutoRun();
                }
            });
            
            const delSpan = document.createElement('span');
            delSpan.className = 'file-tab-delete';
            delSpan.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            delSpan.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                delete fileStore[name]; 
                saveState(); updateTabs(); triggerAutoRun(); 
            });

            tab.appendChild(titleSpan); tab.appendChild(delSpan);
            fileTabsContainer.appendChild(tab);
        });

        const activeFile = fileStore[activeFileName];
        if (activeFile.type === 'asset') {
            editor.readOnly = true;
            editor.value = activeFile.content;
        } else {
            editor.readOnly = false;
            editor.value = activeFile.content;
        }
        saveState();
    }
    updateTabs(); // 初期描画

    // --- イベントリスナー ---
    function triggerAutoRun() {
        if (autorunToggle.checked) {
            clearTimeout(autorunTimer);
            autorunTimer = setTimeout(() => runBtn.click(), 800);
        }
    }

    editor.addEventListener('input', () => {
        if (activeFileName && fileStore[activeFileName]) {
            fileStore[activeFileName].content = editor.value;
            saveState();
            triggerAutoRun();
        }
    });

    // 【新機能】エディタでのTabキーインデント対応
    editor.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 4;
            
            if (activeFileName && fileStore[activeFileName]) {
                fileStore[activeFileName].content = this.value;
                saveState(); triggerAutoRun();
            }
        }
    });

    addFileBtn.addEventListener('click', () => {
        const newName = prompt('新しいファイル名を入力してください (例: script.js)');
        if (!newName) return;
        if (fileStore[newName]) { showAlert('既に存在します'); return; }
        
        const ext = getFileType(newName);
        fileStore[newName] = { type: (ext==='js'||ext==='css'||ext==='html') ? ext : 'txt', originalExt: ext, content: '' };
        saveState(); updateTabs(newName);
    });

    // ファイル読み込み処理
    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;

        const keys = Object.keys(fileStore);
        if (keys.length === 1 && keys[0] === 'index.html' && fileStore['index.html'].content.trim() === '') {
            delete fileStore['index.html'];
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const originalExt = getFileType(file.name);
            
            if (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                // 【新機能】DataURLとして読み込み保存可能にする
                const reader = new FileReader();
                reader.onload = (event) => {
                    fileStore[file.name] = { 
                        type: 'asset', originalExt: originalExt, dataUrl: event.target.result, 
                        content: `/* アセットファイル: ${file.name} */\n\n※このファイルは素材データです。\nエディタでの編集はできません。\n\n【使い方】\nHTMLやJSで「${file.name}」と書くだけで自動的に読み込まれます！` 
                    };
                    saveState(); updateTabs(); triggerAutoRun();
                };
                reader.readAsDataURL(file);
            } else {
                const content = await file.text();
                fileStore[file.name] = { type: (originalExt==='js'||originalExt==='css'||originalExt==='html') ? originalExt : 'txt', originalExt: originalExt, content: content };
                saveState();
            }
        }
        setTimeout(() => { updateTabs(); triggerAutoRun(); }, 100);
        fileInput.value = ''; 
    });

    // --- コンソールスクリプト ---
    const getConsoleScript = () => `
    <script>
    (function(){
        const oldLog = console.log; const oldError = console.error;
        let cEl = null; let cBody = null; let msgCount = 0;
        function initConsole() {
            if(cEl) return;
            cEl = document.createElement('div');
            cEl.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:30%;background:rgba(15,23,42,0.95);color:#fff;font-family:monospace;font-size:12px;z-index:999999;box-sizing:border-box;border-top:3px solid #6366f1;display:flex;flex-direction:column;';
            const header = document.createElement('div');
            header.style.cssText = 'padding:6px 10px;background:#1e293b;display:flex;justify-content:space-between;align-items:center;';
            header.innerHTML = '<span style="font-weight:bold;color:#818cf8;">▶ Console Log</span>';
            const closeBtn = document.createElement('button'); closeBtn.innerText = '閉じる';
            closeBtn.style.cssText = 'background:#ef4444;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;';
            closeBtn.onclick = () => { cEl.style.display = 'none'; };
            header.appendChild(closeBtn);
            cBody = document.createElement('div'); cBody.style.cssText = 'flex:1;overflow-y:auto;padding:10px;';
            cEl.appendChild(header); cEl.appendChild(cBody);
            document.body.appendChild(cEl);
        }
        function print(args, color) {
            if(document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => print(args, color)); return; }
            if(!document.body) return;
            initConsole(); cEl.style.display = 'flex';
            const line = document.createElement('div');
            line.style.cssText = \`color:\${color};padding:2px 0;word-break:break-all;\`;
            line.innerText = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            cBody.appendChild(line);
            cBody.scrollTop = cBody.scrollHeight;
            if(++msgCount > 100) cBody.removeChild(cBody.firstChild);
        }
        console.log = function(...args) { oldLog.apply(console, args); print(args, '#10b981'); };
        console.error = function(...args) { oldError.apply(console, args); print(args, '#ef4444'); };
        window.addEventListener('error', e => console.error(e.message));
    })();
    <\/script>`;

    // --- コード実行（合体ロジック） ---
    runBtn.addEventListener('click', () => {
        const fileNames = Object.keys(fileStore);
        if (fileNames.length === 0) return;

        let htmlContent = ''; let cssContents = []; let jsContents = [];
        let assetFiles = {};

        fileNames.forEach(name => {
            const file = fileStore[name];
            if (file.type === 'asset') assetFiles[name] = file.dataUrl; // Blobではなく保存可能なDataURLを使用
            else if (file.type === 'html' && !htmlContent) htmlContent = file.content;
            else if (file.type === 'css') cssContents.push(file.content);
            else if (file.type === 'js') jsContents.push(file.content);
        });

        if (!htmlContent) htmlContent = `<!DOCTYPE html>\n<html lang="ja">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>\n<body></body>\n</html>`;

        if (cssContents.length > 0) {
            const styleTag = `<style>\n${cssContents.join('\n')}\n</style>`;
            if (htmlContent.includes('</head>')) htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`);
            else htmlContent = `${styleTag}\n${htmlContent}`;
        }

        if (jsContents.length > 0) {
            const scriptTag = `<script>\n${jsContents.join('\n')}\n<\/script>`;
            if (htmlContent.includes('</body>')) htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`);
            else htmlContent = `${htmlContent}\n${scriptTag}`;
        }

        const consoleScript = getConsoleScript();
        if (htmlContent.includes('<body')) htmlContent = htmlContent.replace(/(<body[^>]*>)/i, `$1\n${consoleScript}`);
        else htmlContent = `${consoleScript}\n${htmlContent}`;

        // 【新機能】アセット名の安全な置換 (replaceAllを使用)
        Object.keys(assetFiles).forEach(assetName => {
            htmlContent = htmlContent.replaceAll(assetName, assetFiles[assetName]);
        });

        lastCompiledHtml = htmlContent;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        previewPlaceholder.style.display = 'none';
        previewFrame.src = url;
    });

    // --- その他のUI操作 ---
    downloadBtn.addEventListener('click', () => {
        if (!lastCompiledHtml) { showAlert('まずはコードを実行してください。'); return; }
        let cleanHtml = lastCompiledHtml.replace(getConsoleScript(), '');
        const blob = new Blob([cleanHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'WebRunnerApp.html';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    resetBtn.addEventListener('click', () => {
        showConfirm('すべてのファイルを消去します。よろしいですか？', () => {
            fileStore = { 'index.html': { type: 'html', originalExt: 'html', content: '' } };
            saveState(); updateTabs('index.html'); lastCompiledHtml = '';
            previewFrame.src = 'about:blank'; previewPlaceholder.style.display = 'flex';
        });
    });

    fullscreenBtn.addEventListener('click', () => {
        previewSection.classList.toggle('fullscreen-active');
        fsText.textContent = previewSection.classList.contains('fullscreen-active') ? '元のサイズに戻す' : '全画面で表示';
    });

    // 【新機能】ドラッグで幅を変更 (リサイザー)
    const resizer = document.getElementById('resizer');
    const editorPanel = document.getElementById('editor-panel');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerWidth = document.querySelector('.workspace').clientWidth;
        // マウス位置のパーセンテージを計算（最低20%, 最大80%に制限）
        let newWidth = (e.clientX / containerWidth) * 100;
        if(newWidth < 20) newWidth = 20;
        if(newWidth > 80) newWidth = 80;
        editorPanel.style.flex = `0 0 ${newWidth}%`;
    });
    document.addEventListener('mouseup', () => {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = '';
    });

    // 【新機能】ダークモード切り替え
    const themeBtn = document.getElementById('theme-btn');
    const themeIcon = document.getElementById('theme-icon');
    
    function toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('wfr_theme', 'light');
            themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'; // 月
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('wfr_theme', 'dark');
            themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'; // 太陽
        }
    }
    themeBtn.addEventListener('click', toggleTheme);
    
    // 保存されたテーマの読み込み
    if (localStorage.getItem('wfr_theme') === 'dark') {
        toggleTheme(); // 初期状態から切り替え
    }
});
