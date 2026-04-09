'use strict';

(async () => {
	const waitFor = (cb) =>
		new Promise((r) => {
			let interval;
			interval = setInterval(() => {
				if (!cb()) return;
				clearInterval(interval);
				r();
			});
			const rqa = () => {
				if (cb()) r();
				else requestAnimationFrame(rqa);
			};
			rqa();
		});
	const loaded = document.querySelector('#loaded');
	let loadedCount = 1;
	const checks = [() => window.initDisassembler, () => window.initField, () => window.initAlgorithms];
	for (const cb of checks) {
		waitFor(cb).then(() => {
			++loadedCount;
			loaded.textContent = `${loadedCount}/${checks.length + 1} modules loaded`;
		});
	}

	const fileBlob = await new Promise((resolve) => {
		const input = document.querySelector('#file-input');
		input.addEventListener('input', (e) => resolve(input.files[0]));
	});

	const fileLoadingStart = performance.now();

	const file = (window.file = new DataView(
		await new Promise((resolve) => {
			const reader = new FileReader();
			reader.addEventListener('load', () => resolve(reader.result));
			reader.readAsArrayBuffer(fileBlob);
		}),
	));

	const sectionLoadingStart = performance.now();

	document.querySelector('#file-input').remove();
	document.querySelector('#title').remove();

	const settings = JSON.parse(localStorage.getItem('settings') || '{}');

	// +---------------------------------------------------------------------------------------------------------------+
	// | Components                                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	const dropdown = (window.dropdown = (values, initialIndex, onchange, onhover, hideArrows) => {
		const container = document.getElementById('dropdown').content.cloneNode(true);
		const dropdown = container.querySelector('.dropdown');
		const left = dropdown.querySelector('.left');
		const selection = dropdown.querySelector('.selection');
		const vee = dropdown.querySelector('.vee');
		const right = dropdown.querySelector('.right');
		const options = dropdown.querySelector('.options');
		const optionBase = dropdown.querySelector('.option');

		const optionElements = [];
		let docListener;
		let open = false;
		let selected = initialIndex;
		const hide = () => {
			if (!open) return;
			if (docListener) removeEventListener('mousedown', docListener);
			options.style.visibility = 'hidden';
			open = false;
			docListener = undefined;
		};
		const select = (i, silent) => {
			optionElements[selected].style.color = '';
			optionElements[i].style.color = 'var(--dropdown-fg)';
			selection.innerHTML = values[i];

			selected = i;
			dropdown.value = i;
			dropdown.hovered = undefined;
			if (!silent) onchange(i);
		};

		for (let i = 0; i < values.length; ++i) {
			const value = values[i];
			const option = optionBase.cloneNode();
			option.innerHTML = value;
			options.appendChild(option);
			optionElements.push(option);

			option.addEventListener('mouseup', () => {
				hide();
				select(i);
			});

			option.addEventListener('mouseenter', () => {
				dropdown.hovered = i;
				onhover?.(i);
			});
		}
		optionBase.remove();

		options.addEventListener('mouseleave', () => {
			dropdown.hovered = undefined;
			onhover?.(undefined);
		});

		select(initialIndex, true);

		left.addEventListener('mousedown', () => {
			if (selected <= 0) return;
			select(selected - 1);
		});

		right.addEventListener('mousedown', () => {
			if (selected >= values.length - 1) return;
			select(selected + 1);
		});

		// not really a better way to do this
		let interval;
		interval = setInterval(() => {
			const box = options.getBoundingClientRect();
			if (box.width <= 0) return;
			clearInterval(interval);

			selection.style.width = `calc(${options.getBoundingClientRect().width - 2}px - ${hideArrows ? '0em' : '2em - 12px'})`;
		});

		if (hideArrows) {
			left.style.display = right.style.display = 'none';
			options.style.padding = '0 calc(1.5em + 6px) 0 0.5em';
			vee.style.display = 'inline-block';
		}

		selection.addEventListener('mousedown', (e) => {
			if (open) {
				hide();
				return;
			}

			const box = selection.getBoundingClientRect();
			let height;
			if (box.y > innerHeight / 2) {
				// top side has more space
				options.style.top = '';
				options.style.bottom = 'calc(1em + 8px - 2px)';
				height = box.y - 32;
				options.style.maxHeight = `${height}px`;
			} else {
				// bottom side has more space
				options.style.top = 'calc(1em + 8px - 2px)';
				options.style.bottom = '';
				height = innerHeight - box.y - 32;
				options.style.maxHeight = `calc(${height}px - 12px)`;
			}
			options.style.visibility = '';
			open = true;

			options.scroll(
				0,
				optionElements[selected].offsetTop + optionElements[selected].offsetHeight / 2 - height / 2,
			);

			if (docListener) return;
			docListener = (e) => {
				if (options.contains(e.target)) return;
				hide();
			};
			setTimeout(() => addEventListener('mousedown', docListener));
		});

		return dropdown;
	});

	const checkbox = (window.checkbox = (name, checked, onchange) => {
		const container = document.getElementById('checkbox').content.cloneNode(true);
		const checkbox = container.querySelector('.checkbox');
		const check = checkbox.querySelector('.check');
		const label = checkbox.querySelector('.label');

		label.innerHTML = name;
		if (name === '') {
			checkbox.style.padding = '0';
			label.remove();
		}

		checkbox.set = (newChecked, silent) => {
			checked = newChecked;
			checkbox.checked = checked;
			if (checked) checkbox.classList.add('checked');
			else checkbox.classList.remove('checked');
			if (!silent) onchange(checked);
		};

		checkbox.set(checked, true);
		checkbox.addEventListener('mousedown', () => checkbox.set(!checked));

		return checkbox;
	});

	const button = (window.button = (name, onchange) => {
		const button = document.createElement('button');
		button.innerHTML = name;
		button.addEventListener('mousedown', () => onchange());
		return button;
	});

	const hovery = (window.hovery = (html, onhover) => {
		const span = document.createElement('span');
		span.style.cssText =
			'background: #333; border: 1px solid #fff; color: #ccc; cursor: default; font-size: 0.9rem; padding: 0 3px;';
		span.innerHTML = html;
		span.addEventListener('mouseenter', () => {
			span.style.background = '#666';
			onhover(true);
		});
		span.addEventListener('mouseleave', () => {
			span.style.background = '#333';
			onhover(false);
		});
		return span;
	});

	// +---------------------------------------------------------------------------------------------------------------+
	// | Quick Data Display                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const byteToChar = [];
	for (let i = 0; i < 0x20; ++i) byteToChar[i] = '.';
	for (let i = 0x20; i < 0x7f; ++i) byteToChar[i] = String.fromCharCode(i);
	for (let i = 0x7f; i < 0xa0; ++i) byteToChar[i] = '.';
	for (let i = 0xa0; i < 0x100; ++i) byteToChar[i] = String.fromCharCode(i);
	const latin1 = (window.latin1 = (o, l, dat) => {
		let end;
		if (l !== undefined) {
			end = o + l;
		} else {
			end = o;
			while (dat.getUint8(end)) ++end;
		}

		const u8 = bufToU8(sliceDataView(dat, o, Math.min(end, dat.byteLength)));
		const arr = new Array(u8.length);
		for (let i = 0; i < u8.length; ++i) arr[i] = byteToChar[u8[i]];
		return arr.join('');
	});

	const shiftJisDecoder = new TextDecoder('shift_jis');
	const shiftJis = (window.shiftJis = (dat, o) => {
		let end = o;
		while (end < dat.byteLength && dat.getUint8(end)) ++end;
		return shiftJisDecoder.decode(bufToU8(sliceDataView(dat, o, end)));
	});

	// barebones text, without any formatting or replacement characters
	const bisAlphabetJapanese = [
		'', 'ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ', 'ダ', '×', 'ヅ', 'デ', 'ド',
		'バ', 'ビ', 'ブ', 'べ', 'ボ', 'が', 'ぎ', 'ぐ', 'げ', 'ご', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'ゃ',
		'', '！', 'ゅ', 'ょ', 'っ', '%', '&', '\'', '(', ')', '・', '+', ',', '-', '.', '/',
		'０', '１', '２', '３', '４', '５', '６', '７', '８', '９', ':', ';', '。', '=', '、', '？',
		'一', 'Ａ', 'Ｂ', 'Ｃ', 'Ｄ', 'Ｅ', 'Ｆ', 'Ｇ', 'Ｈ', 'Ｉ', 'Ｊ', 'Ｋ', 'Ｌ', 'Ｍ', 'Ｎ', 'Ｏ',
		'Ｐ', 'Ｑ', 'Ｒ', 'Ｓ', 'Ｔ', 'Ｕ', 'Ｖ', 'Ｗ', 'Ｘ', 'Ｙ', 'Ｚ', '[', '¥', ']', 'わ', 'を',
		'ん', 'ａ', 'ｂ', 'ｃ', 'ｄ', 'ｅ', 'ｆ', 'ｇ', 'ｈ', 'ｉ', 'ｊ', 'ｋ', 'ｌ', 'ｍ', 'ｎ', 'ｏ',
		'ｐ', 'ｑ', 'ｒ', 'ｓ', 'ｔ', 'ｕ', 'ｖ', 'ｗ', 'ｘ', 'ｙ', 'ｚ', 'ば', 'び', 'ぶ', '〜', 'べ',
		'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', '…', 'ぽ', 'だ', 'ぢ', 'づ', 'で', 'ど', 'ぁ', 'ぃ', 'ぅ', 'ぇ',
		'ぉ', 'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ',
		'「', '」', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ', 'ッ', 'ア', 'イ', 'ウ', 'エ', 'オ',
		'カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ッ', 'テ', 'ト', 'ナ',
		'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ',
		'ヨ', 'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ', 'ン', 'パ', 'ピ', 'プ', 'ペ', 'ポ', 'た', 'ち', 'つ',
		'て', 'と', 'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め',
		'も', 'や', 'ゆ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ',
	];
	const bisAlphabetLatin = [
		'', '⬆︎', '⮕', '⬇︎', '⬅︎', 'Ⓧ', '', 'Ⓨ', '', '♥︎', '♪', '★', '×', 'ᵉ', 'ᵉʳ', 'ʳᵉ',
		'↑', '', '↓', '', '←', '', '→', '', 'Ⓛ', '', 'Ⓡ', '', 'Ⓐ', '', 'Ⓑ', '',
		' ', '!', '˝', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
		'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '', '=', '', '?',
		'˵', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
		'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '', '_',
		'`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 
		'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '', '}', '~', '',
		'©', '', ',', '', '„', '…', '●', '', '▲', '', '■', '', 'Œ', '', '', '',
		'', '‘', '’', '“', '”', '•', '', '-', '', '', '', '', 'œ', '', '', '',
		'', '¡', '', '', '', '¥', '', '', '', '', 'ª', '«', '', '', '', '',
		'°', '', '', '', '', '', '', '', '', '', 'º', '»', '', '', '', '¿', // TODO: which is masculine ordinal indicator?
		'À', 'Á', 'Â', '', 'Ä', 'Å', '', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï',
		'', 'Ñ', 'Ò', 'Ó', 'Ô', '', 'Ö', '', '', 'Ù', 'Ú', 'Û', 'Ü', '', '', 'ẞ',
		'à', 'á', 'â', '', 'ä', 'å', '', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï',
		'', 'ñ', 'ò', 'ó', 'ô', '', 'ö', '', '', 'ù', 'ú', 'û', 'ü',
	];
	const bisAlphabetKorean = [];
	const bisAlphabetChinese = [];
	const bisUnicode = (window.bisUnicode = (dat, alphabetName) => {
		const u8 = bufToU8(dat);
		const out = [];

		for (let o = 0; o < u8.length;) {
			const char = u8[o++];
			if (char === 0xff) {
				// formatting
				const control = u8[o++];
				if (control === 0) out.push(' '); // newline; ignore it here
				else if (control === 1) { out.push('\n'); ++o; } // reset text
				else if (control === 0x0a) ++o; // close textbox
				else if (control === 0x0b) ++o; // new textbox page
				else if (control === 0x0c) ++o; // wait
				else if (control === 0x0f) o += 2; // variable display
				else if (control === 0x11) ++o;
				continue;
			}

			if (alphabetName === 'latin') {
				if (bisAlphabetLatin[char]) out.push(bisAlphabetLatin[char]);
			} else if (alphabetName === 'japanese' || alphabetName === 'korean') {
				if (char >= 0xf9) {
					out.push('?');
					++o;
				} else if (alphabetName === 'japanese') {
					if (bisAlphabetJapanese[char]) out.push(bisAlphabetJapanese[char]);
				} else if (alphabetName === 'korean') {
					if (bisAlphabetKorean[char]) out.push(bisAlphabetKorean[char]);
				}
			} else if (alphabetName === 'chinese') {
			}
		}

		return out.join('');
	});

	const byteToHex = [];
	for (let i = 0; i < 256; ++i) byteToHex[i] = i.toString(16).padStart(2, '0');
	const bytes = (window.bytes = (o, l, buf) => {
		const slice = new Uint8Array(
			buf.buffer.slice(Math.max(buf.byteOffset + o, 0), buf.byteOffset + Math.min(o + l, buf.byteLength)),
		);
		const arr = new Array(slice.length);
		for (let i = 0; i < slice.length; ++i) arr[i] = byteToHex[slice[i]];
		return arr.join(' ');
	});

	const bits = (window.bits = (o, l, buf) => {
		const slice = buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + l);
		return Array.from(new Uint8Array(slice))
			.map((x) => x.toString(2).padStart(8, '0'))
			.join(' ');
	});

	const sanitize = (window.sanitize = (s) => s.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));

	const addHTML = (window.addHTML = (el, html) => {
		const container = document.createElement(el.tagName); // tables do a *lot* of weird stuff without this
		container.innerHTML = html;
		// make a copy of childNodes first; it will end up empty
		for (const child of Array.from(container.childNodes)) el.append(child);
	});

	const writeRgb16 = (window.writeRgb16 = (bitmap, pixel, rgb16) => {
		const r = rgb16 & 0x1f;
		const g = (rgb16 >> 5) & 0x1f;
		const b = (rgb16 >> 10) & 0x1f;
		bitmap[pixel * 4] = (r << 3) | (r >> 2);
		bitmap[pixel * 4 + 1] = (g << 3) | (g >> 2);
		bitmap[pixel * 4 + 2] = (b << 3) | (b >> 2);
		bitmap[pixel * 4 + 3] = 255;
	});

	const str8 = (window.str8 = (x) => x.toString(16).padStart(2, '0'));
	const str16 = (window.str16 = (x) => x.toString(16).padStart(4, '0'));
	const str24 = (window.str24 = (x) => x.toString(16).padStart(6, '0'));
	const str32 = (window.str32 = (x) => x.toString(16).padStart(8, '0'));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Algorithms                                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initAlgorithms) await waitFor(() => window.initAlgorithms);
	window.initAlgorithms();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Misc                                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const unpackSegmented = (window.unpackSegmented = (dat) => {
		if (dat.byteLength < 4) return [];
		const offsetsEnd = dat.getUint32(0, true);
		let lastSplit = offsetsEnd;
		const segments = [];
		for (let o = 4; o < offsetsEnd; o += 4) {
			const split = dat.getUint32(o, true);
			if (lastSplit >= dat.byteLength) segments.push(sliceDataView(dat, 0, 0));
			else segments.push(sliceDataView(dat, lastSplit, split));
			lastSplit = split;
		}

		segments.push(sliceDataView(dat, lastSplit, dat.byteLength));
		return segments;
	});

	const unpackSegmented16 = (window.unpackSegmented16 = (dat) => {
		if (dat.byteLength < 2) return [];
		const offsetsEnd = dat.getUint16(0, true);
		let lastSplit = offsetsEnd;
		const segments = [];
		for (let i = 1; i < offsetsEnd; ++i) {
			const split = dat.getUint16(i * 2, true);
			segments.push(sliceDataView(dat, lastSplit * 2, split * 2));
			lastSplit = split;
		}

		segments.push(sliceDataView(dat, lastSplit * 2, dat.byteLength));
		return segments;
	});

	const unpackSegmentedUnsorted = (window.unpackSegmentedUnsorted = (dat, o = 0) => {
		let min = Infinity;
		const offsets = [];
		for (; o < dat.byteLength && o < min; o += 4) {
			const offset = dat.getUint32(o, true);
			offsets.push({ offset });
			if (offset < min) min = offset;
		}

		const offsetsSorted = [...offsets];
		offsetsSorted.sort(({ offset: a }, { offset: b }) => a - b);
		for (let i = 0; i < offsetsSorted.length; ++i) {
			offsetsSorted[i].until = offsetsSorted[i + 1]?.offset ?? dat.byteLength;
		}

		const segments = [];
		for (const { offset, until } of offsets) {
			segments.push(sliceDataView(dat, offset, until));
		}

		return segments;
	});

	const sliceDataView = (dat, start, end) => new DataView(dat.buffer, dat.byteOffset + start, end - start);
	const bufToU8 = (buf, off = buf.byteOffset, len = buf.byteLength) => new Uint8Array(buf.buffer, off, len);
	const bufToU8Clamped = (buf, off = buf.byteOffset, len = buf.byteLength) =>
		new Uint8ClampedArray(buf.buffer, off, len);
	const bufToU16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) => new Uint16Array(buf.buffer, off, len);
	const bufToS16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) => new Int16Array(buf.buffer, off, len);
	const bufToU32 = (buf, off = buf.byteOffset, len = buf.byteLength >> 2) => new Uint32Array(buf.buffer, off, len);
	const bufToS32 = (buf, off = buf.byteOffset, len = buf.byteLength >> 2) => new Int32Array(buf.buffer, off, len);
	const bufToDat = (buf, off = buf.byteOffset, len = buf.byteLength) => new DataView(buf.buffer, off, len);
	Object.assign(window, { sliceDataView, bufToU8, bufToU8Clamped, bufToU16, bufToS16, bufToU32, bufToDat });

	const download = (window.download = (name, dat, mime = 'application/octet-stream') => {
		const blob = new Blob([dat], { type: mime });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000); // idk if a timeout is really necessary
	});

	const readMessage = (window.readMessage = (o, dat, ignoreSpecials) => {
		const u8 = bufToU8(dat);
		const s = [];
		for (; o < u8.length; ) {
			const byte = u8[o++];
			if (byte === 0xff) {
				const next = u8[o++];
				if (next === 0) s.push('\n');
				else if (ignoreSpecials) s.push(' ');
				else s.push(`<${str8(next)}>`);
			} else if (byte <= 0x1f || byte >= 0xfa || byte === 0x7f) {
				// special symbol
				if (ignoreSpecials) s.push(' ');
				else s.push(`(${str8(byte)})`);
			} else if (byte === 0x85) {
				s.push('…');
			} else {
				// assume latin1
				s.push(String.fromCharCode(byte));
			}
		}

		return s.join('');
	});

	const createSection = (window.createSection = (title, cb) => {
		const section = document.createElement('section');
		const reveal = document.createElement('div');
		reveal.className = 'reveal';
		reveal.innerHTML = `<code>[-]</code> ${title}`;
		section.appendChild(reveal);

		const content = document.createElement('div');
		content.className = 'content';
		section.appendChild(content);

		let visible = true;
		const toggleVisible = (newVisible) => {
			if (newVisible === visible) return;
			visible = newVisible;
			settings[`section.${title}.visible`] = visible;
			localStorage.setItem('settings', JSON.stringify(settings));

			content.style.display = visible ? '' : 'none';
			reveal.innerHTML = `<code>${visible ? '[-]' : '[+]'}</code> ${title}`;

			section.style.height = visible ? '' : '32px';
		};
		reveal.addEventListener('mousedown', (e) => {
			if (e.button === 0) toggleVisible(!visible);
		});
		toggleVisible(settings[`section.${title}.visible`] ?? true);

		let result;
		try {
			result = cb(content);
		} catch (err) {
			console.error(err);
			addHTML(
				content,
				`<span style="color: #f99;">${sanitize(err.name)}: ${sanitize(err.message)}<br>
				${sanitize(err.stack).replaceAll('\n', '<br>')}</span>`,
			);
		}

		if (content.children.length) document.body.appendChild(section);
		return result;
	});

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: ROM Headers                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const headers = (window.headers = createSection('ROM Headers', (section) => {
		const fields = [];
		const headers = {};

		headers.title = sanitize(latin1(0, 12, file));
		headers.gamecode = sanitize(latin1(12, 4, file));
		fields.push(['Title', `${headers.title} (${headers.gamecode})`]);
		document.title = `(${headers.gamecode}) MLBIS Dumper`;

		headers.arm9offset = file.getUint32(0x20, true);
		headers.arm9entry = file.getUint32(0x24, true);
		headers.arm9ram = file.getUint32(0x28, true);
		headers.arm9size = file.getUint32(0x2c, true);
		fields.push([
			'ARM9',
			`0x${str32(headers.arm9offset)}, len 0x${headers.arm9size.toString(16)},
				ram 0x${headers.arm9ram.toString(16)}, entry 0x${headers.arm9entry.toString(16)}`,
		]);

		headers.arm7offset = file.getUint32(0x30, true);
		headers.arm7entry = file.getUint32(0x34, true);
		headers.arm7ram = file.getUint32(0x38, true);
		headers.arm7size = file.getUint32(0x3c, true);
		fields.push([
			'ARM7',
			`0x${str32(headers.arm7offset)}, len 0x${headers.arm7size.toString(16)},
				ram 0x${headers.arm7ram.toString(16)}, entry 0x${headers.arm7entry.toString(16)}`,
		]);

		headers.fntOffset = file.getUint32(0x40, true);
		headers.fntLength = file.getUint32(0x44, true);
		fields.push(['FNT', `0x${str32(headers.fntOffset)}, len 0x${headers.fntLength.toString(16)}`]);

		headers.fatOffset = file.getUint32(0x48, true);
		headers.fatLength = file.getUint32(0x4c, true);
		fields.push(['FAT', `0x${str32(headers.fatOffset)}, len 0x${headers.fatLength.toString(16)}`]);

		headers.ov9Offset = file.getUint32(0x50, true);
		headers.ov9Size = file.getUint32(0x54, true);
		fields.push(['ARM9 Overlays', `0x${str32(headers.ov9Offset)}, len 0x${headers.ov9Size.toString(16)}`]);

		headers.ov7Offset = file.getUint32(0x58, true);
		headers.ov7Size = file.getUint32(0x5c, true);
		fields.push(['ARM7 Overlays', `0x${str32(headers.ov7Offset)}, len 0x${headers.ov7Size.toString(16)}`]);

		headers.arm9HooksList = file.getUint32(0x70, true);
		fields.push(['ARM9 Hooks List', `0x${str32(headers.arm9HooksList)}`]);
		headers.arm7HooksList = file.getUint32(0x74, true);
		fields.push(['ARM7 Hooks List', `0x${str32(headers.arm7HooksList)}`]);

		for (const [name, value] of fields) {
			addHTML(section, `<div><code>${name}: ${value}</code></div>`);
		}

		return headers;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const fs = (window.fs = createSection('File System', (section) => {
		const fs = new Map();

		fs.arm9 = sliceDataView(file, headers.arm9offset, headers.arm9offset + headers.arm9size);
		fs.arm7 = sliceDataView(file, headers.arm7offset, headers.arm7offset + headers.arm7size);

		// NA, EU, and KO versions compress initial arm9/arm7; no idea what in the header controls that
		let arm7Compressed = false, arm9Compressed = false;
		if (['CLJE', 'CLJP', 'CLJK'].includes(headers.gamecode)) {
			// NA, EU, and KO versions completely compress initial arm9/arm7
			fs.arm9 = blz(fs.arm9);
			fs.arm7 = blz(fs.arm7);
			arm7Compressed = arm9Compressed = true;
		} else if (headers.gamecode === 'CLJJ' && fs.arm9.getUint32(0x371fc, true) === 0xffffffff) {
			// JP (not ROC) compresses most of the arm9, but not the arm7
			const dec9 = blz(sliceDataView(fs.arm9, 0x4000, 0x3718c));
			const new9 = new DataView(new ArrayBuffer(dec9.byteLength + 0x4000));
			bufToU8(new9).set(bufToU8(sliceDataView(fs.arm9, 0, 0x4000)), 0);
			bufToU8(new9).set(bufToU8(dec9), 0x4000);
			fs.arm9 = new9;
			arm9Compressed = true;
		}

		const names = new Map();
		names.set(0xf000, ''); // so every fie path starts with '/'
		const parents = new Map();
		const numDirectories = file.getUint16(headers.fntOffset + 6, true);
		for (let i = 0; i < numDirectories; ++i) {
			let o = file.getUint32(headers.fntOffset + i * 8, true);
			let fileId = file.getUint16(headers.fntOffset + i * 8 + 4, true);

			while (true) {
				const composite = file.getUint8(headers.fntOffset + o++);
				if (!composite) break;

				const name = latin1(headers.fntOffset + o, composite & 0x7f, file);
				o += composite & 0x7f;
				let id;
				if (composite & 0x80) {
					id = file.getUint16(headers.fntOffset + o, true);
					o += 2;
				} else id = fileId++;
				names.set(id, name);
				parents.set(id, 0xf000 + i);
			}
		}

		const fileToOverlayId = (fs.fileToOverlayId = new Map());
		const overlayEntries = (fs.overlayEntries = new Map());
		for (let i = 0, o = headers.ov9Offset; i * 32 < headers.ov9Size; ++i, o += 32) {
			const segment = bufToU32(sliceDataView(file, o, o + 32));
			const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compressed] = segment;
			fileToOverlayId.set(fileId, id);
			overlayEntries.set(id, { id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compressed });
		}

		const overlayCache = new Map();
		fs.overlay = (id, noCache) => {
			const cached = overlayCache.get(id);
			if (cached) return cached;

			// no errors!
			const entry = overlayEntries.get(id);
			let dat = fs.get(entry.fileId);
			if (entry?.compressed) dat = blz(dat);
			if (dat && !noCache) overlayCache.set(id, Object.assign(dat, { entry }));
			return dat;
		};

		for (let i = 0, o = headers.fatOffset; i * 8 < headers.fatLength; ++i, o += 8) {
			const start = file.getUint32(o, true);
			const end = file.getUint32(o + 4, true);

			let name, path;
			const overlayId = fileToOverlayId.get(i);
			if (overlayId !== undefined) {
				const entry = overlayEntries.get(overlayId);
				name = `overlay${overlayId.toString().padStart(4, '0')}.bin`;
				path = `(overlay ${overlayId.toString().padStart(4, '0')}${entry.compressed ? ', compressed' : ''})`;
			} else {
				name = names.get(i);
				path = name;
				let parentId = parents.get(i);
				for (let j = 0; j < 100 && parentId !== undefined; ++j) {
					path = names.get(parentId) + '/' + path;
					parentId = parents.get(parentId);
				}
			}

			const obj = Object.assign(sliceDataView(file, start, end), { name, path, start, end });
			fs.set(i, obj);
			if (overlayId === undefined) fs.set(path, obj);
		}

		const singleExport = document.createElement('div');
		singleExport.textContent = 'File: ';
		section.appendChild(singleExport);

		const singleSelectEntries = [
			`ARM9 (len 0x${headers.arm9size.toString(16)}${arm9Compressed ? ', compressed' : ''})`,
			`ARM7 (len 0x${headers.arm7size.toString(16)}${arm7Compressed ? ', compressed' : ''})`,
		];
		for (let i = 0; i * 8 < headers.fatLength; ++i) {
			const { start, end, path } = fs.get(i);
			singleSelectEntries.push(`0x${str8(i)}. (len 0x${(end - start).toString(16)}) ${sanitize(path)}`);
		}
		const singleSelect = dropdown(singleSelectEntries, 0, () => {});
		singleExport.appendChild(singleSelect);

		const singleDecompression = dropdown(
			['No decompression', 'BLZ on compressed overlays only'],
			1,
			() => {},
			undefined,
			true,
		);
		singleExport.appendChild(singleDecompression);

		const singleDump = button('Dump', () => {
			if (singleSelect.value === 0) {
				singleOutput.textContent = '';
				if (singleDecompression.value === 0) {
					download('arm9.bin', sliceDataView(file, headers.arm9offset, headers.arm9offset + headers.arm9size));
				} else download('arm9.bin', fs.arm9);
				return;
			} else if (singleSelect.value === 1) {
				singleOutput.textContent = '';
				if (singleDecompression.value === 0) {
					download('arm7.bin', sliceDataView(file, headers.arm7offset, headers.arm7offset + headers.arm7size));
				} else download('arm7.bin', fs.arm7);
				return;
			}
			const fsentry = fs.get(singleSelect.value - 2);

			let output;
			if (singleDecompression.value === 0) output = fsentry;
			else {
				const overlayId = fileToOverlayId.get(singleSelect.value - 2);
				if (overlayId !== undefined) output = fs.overlay(overlayId, true);
				else output = fsentry;
			}

			if (!output) {
				singleOutput.textContent = '(Failed to decompress; only backwards LZSS is supported)';
				return;
			}

			singleOutput.textContent = '';
			download(fsentry.name, output);
		});
		singleExport.appendChild(singleDump);

		const singleOutput = document.createElement('span');
		singleExport.appendChild(singleOutput);

		const multiExport = document.createElement('div');
		multiExport.textContent = 'Everything: ';
		section.appendChild(multiExport);

		const multiDump = button('Dump Everything', () => {
			const files = [
				{ name: 'arm9.bin', dat: fs.arm9 },
				{ name: 'arm7.bin', dat: fs.arm7 },
			];

			for (let i = 0; i * 8 < headers.fatLength; ++i) {
				const fsentry = fs.get(i);
				const overlayId = fileToOverlayId.get(i);
				if (overlayId !== undefined) {
					const dat = fs.overlay(overlayId, true);
					const suffix = dat === fsentry ? '' : '-decomp';
					files.push({ name: `overlay${String(overlayId).padStart(4, '0')}${suffix}.bin`, dat });
				} else {
					files.push({ name: fsentry.name, dat: fsentry });
				}
			}
			download(`${headers.gamecode}.zip`, zipStore(files));
		});
		multiExport.appendChild(multiDump);

		addHTML(section, '<br>');

		const sorting = dropdown(['Sort by index', 'Sort by length'], 0, () => update(), undefined, true);
		section.appendChild(sorting);

		const listContainer = document.createElement('div');
		section.appendChild(listContainer);
		const update = () => {
			listContainer.innerHTML = '';
			const list = [];
			for (let i = 0; i * 8 < headers.fatLength; ++i) list.push([i, fs.get(i)]);

			if (sorting.value === 1) list.sort(([_, a], [__, b]) => a.end - a.start - (b.end - b.start));

			for (let i = 0; i < list.length; ++i) {
				const [index, { path, start, end }] = list[i];
				const lengthStr = (end - start).toString(16);
				addHTML(
					listContainer,
					`<div><code>0x${str8(index)}. 0x${str32(start)} - 0x${str32(end)} (len 0x${lengthStr})
						${'&nbsp;'.repeat(8 - lengthStr.length)} ${path}</code></div>`,
				);
			}
		};
		update();

		return fs;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Overlay Table                                                                                        |
	// +---------------------------------------------------------------------------------------------------------------+

	const ovt = (window.ovt = createSection('Overlay Table', (section) => {
		const ovt = {};

		const mode = dropdown(['RAM Arrangement', 'Overlay Entries', 'String Search'], 0, () => update());
		section.appendChild(mode);

		addHTML(section, `<span style="margin: 0 5px;">Base address: <code>0x02000000</code>, min string length 6</span>`);

		ovt.overlays = [];
		for (let i = 0, o = headers.ov9Offset; o < headers.ov9Offset + headers.ov9Size; ++i, o += 0x20) {
			const overlayU32 = bufToU32(sliceDataView(file, o, o + 0x20));
			const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compression] = overlayU32;
			ovt.overlays.push({ id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compression });
		}

		let downloadCallback = () => {};
		const downloadButton = button('Download', () => downloadCallback());
		downloadButton.style.display = 'none';
		section.appendChild(downloadButton);

		const preview = document.createElement('div');
		preview.style.cssText = 'position: relative';
		section.appendChild(preview);

		const updateRamArrangement = () => {
			let contentHeight = 0;
			const entries = [];

			let selected;
			const updateColors = () => {
				if (selected) {
					const sl = selected.leftAddress;
					const sr = selected.leftAddress + selected.size + selected.bss;
					for (const entry of entries) {
						const l = entry.leftAddress;
						const r = entry.leftAddress + entry.size + entry.bss;
						// start < other.start + other.length && other.start < start + length
						if (entry === selected) {
							entry.row.classList.remove('red');
							entry.row.classList.remove('green');
						} else if (l < sr && sl < r) {
							// the two entries intersect, so they can't possibly be loaded together
							entry.row.classList.add('red');
							entry.row.classList.remove('green');
						} else {
							entry.row.classList.remove('red');
							entry.row.classList.add('green');
						}
					}
				} else {
					for (const { row } of entries) {
						row.classList.remove('red');
						row.classList.remove('green');
					}
				}
			};

			const addEntry = (label, leftAddress, size, bss, overlayU32) => {
				const row = document.createElement('div');
				row.style.cssText = `position: absolute; top: ${contentHeight}px; left: 0px; height: 20px; width: 100%; color: var(--clicky-text);`;
				row.className = 'clicky';
				preview.appendChild(row);

				const left = document.createElement('div');
				left.style.cssText = `position: absolute; top: 0; left: 0; height: 20px; width: 200px; font: 16px "Red Hat Mono";`;
				left.innerHTML = `${'&nbsp;'.repeat(4 - label.length)}${label}.
					${str24(leftAddress - 0x02000000)}-${str24(leftAddress + size - 0x02000000)}`;
				row.appendChild(left);

				const right = document.createElement('div');
				right.style.cssText = `background: var(--clicky-bg); position: absolute; top: 0; left: 200px; height: 20px; width: calc(100% - 200px);`;
				row.appendChild(right);

				const boxExecutable = document.createElement('div');
				boxExecutable.style.cssText = `background: var(--clicky-fill); border: 1px solid var(--clicky-box); position: absolute; top: 0; height: 20px;`;
				boxExecutable.style.left = `${(leftAddress - 0x02000000) / 0x400000 * 100}%`;
				boxExecutable.style.width = `${size / 0x400000 * 100}%`;
				right.appendChild(boxExecutable);

				const boxStatic = document.createElement('div');
				boxStatic.style.cssText = `background: var(--clicky-fill); position: absolute; top: 0; height: 20px;`;
				boxStatic.style.left = `${(leftAddress + size - 0x02000000) / 0x400000 * 100}%`;
				boxStatic.style.width = `${bss / 0x400000 * 100}%`;
				right.appendChild(boxStatic);

				let bssLabel;
				if (bss) {
					bssLabel = document.createElement('div');
					bssLabel.style.cssText = `position: absolute; top: 0; height: 20px; font: 1em "Red Hat Mono"`;
					bssLabel.style.left = `calc(${(leftAddress + size + bss - 0x02000000) / 0x400000 * 100}% + 10px)`;
					bssLabel.textContent = `(BSS 0x${bss.toString(16)})`;
					right.appendChild(bssLabel);
				}

				const entry = { label, leftAddress, size, bss, row };
				entries.push(entry);
				row.addEventListener('mousedown', () => {
					if (selected) {
						selected.row.classList.remove('active');
						if (selected === entry) {
							selected = undefined;
							updateColors();
							return;
						}
					}

					selected = entry;
					row.classList.add('active');
					updateColors();
				});

				contentHeight += 20;
			};

			addEntry('ARM9', headers.arm9ram, fs.arm9.byteLength, 0, undefined);
			addEntry('ARM7', headers.arm7ram, fs.arm7.byteLength, 0, undefined);
			for (let i = 0, o = headers.ov9Offset; o < headers.ov9Offset + headers.ov9Size; ++i, o += 0x20) {
				const overlayU32 = bufToU32(sliceDataView(file, o, o + 0x20));
				addEntry(String(i), overlayU32[1], overlayU32[2], overlayU32[3], overlayU32);
			}
			for (let i = 0, o = headers.ov7Offset; o < headers.ov7Offset + headers.ov7Size; ++i, o += 0x20) {
				const overlayU32 = bufToU32(sliceDataView(file, o, o + 0x20));
				addEntry(String(i), overlayU32[1], overlayU32[2], overlayU32[3], overlayU32);
			}

			preview.style.height = `${contentHeight}px`;
		};

		const updateOverlayEntries = () => {
			const str24 = x => x.toString(16).padStart(6, '0');
			const lines = [];

			const table = document.createElement('table');
			table.className = 'bordered';

			addHTML(table, `<tr>
				<th>ID</th>
				<th>RAM Region</th>
				<th>BSS Region</th>
				<th>Static Initializers</th>
				<th>Compressed?</th>
			</tr>`);

			for (let i = 0, o = headers.ov9Offset; o < headers.ov9Offset + headers.ov9Size; ++i, o += 0x20) {
				const dat = sliceDataView(file, o, o + 0x20);
				const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compression] = bufToU32(dat);

				let overlayDat;
				try {
					// maybe it is compressed using a different algorithm (for non-MLBIS games)
					overlayDat = fs.overlay(i, true);
				} catch (_) {}

				const columns = [];
				columns.push(`${i} (0x${i.toString(16)})`);
				columns.push(`${str32(ramStart)} - ${str32(ramStart + ramSize)}<br>len 0x${ramSize.toString(16)}`);

				if (bssSize) {
					columns.push(`${str32(ramStart + ramSize)} - ${str32(ramStart + ramSize + bssSize)}
						<br>len 0x${bssSize.toString(16)}`);
				} else {
					columns.push('-');
				}

				const staticInitializers = [];
				for (let o2 = staticStart; o2 < staticEnd; o2 += 4) {
					const pointed = overlayDat?.getUint32(o2 - ramStart, true);
					let note = '→ NULL';
					if (pointed) note = `→ FUN_${str32(pointed)}`;
					staticInitializers.push(`${str32(o2)} ${note}`);
				}
				columns.push(staticInitializers.join('<br>'));

				if (compression) {
					const compressionType = [, 'BLZ'][compression >> 24] ?? '?';
					columns.push(`${compression >> 24} (${compressionType})<br>len 0x${(compression & 0xffffff).toString(16)}`);
				} else {
					columns.push('-');
				}

				addHTML(table, `<tr style="font-family: Red Hat Mono; text-align: center;">${columns.map(x => '<td>' + x + '</td>').join('')}</tr>`);
			}

			preview.appendChild(table);

			for (let i = 0, o = headers.ov9Offset; o < headers.ov9Offset + headers.ov9Size; ++i, o += 0x20) {
				const dat = sliceDataView(file, o, o + 0x20);
				const str24 = x => x.toString(16).padStart(6, '0');

				const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, attributes] = bufToU32(dat);
				lines.push(`${String(id).padStart(4, '0')}`
					+ ` | ram ${str24(ramStart - 0x02000000)}-${str24(ramStart - 0x02000000 + ramSize)}`
					+ ` | static ${str24(staticStart - 0x02000000)}-${str24(staticEnd - 0x02000000)}`
					+ ` | bss ${str16(bssSize)} | attributes ${str32(attributes)} | size ${str32(ramSize)}`);
			}

			const downloadContent = lines.join('\n');
			downloadButton.style.display = '';
			downloadCallback = () => download(`${headers.gamecode}-overlays.txt`, downloadContent);
		};

		const updateStringSearch = () => {
			const lines = [];
			const search = (label, dat) => {
				const found = [];
				const u8 = bufToU8(dat);

				let lastInvalid = -1;
				for (let o = 0; o < u8.length; ++o) {
					// valid characters: A-Z a-z 0-9 - _ . , /
					const byte = u8[o];
					const valid = (0x41 <= byte && byte <= 0x5a) || (0x61 <= byte && byte <= 0x7a)
						|| (0x30 <= byte && byte <= 0x39) || byte === 0x2d || byte === 0x5f || byte === 0x2e
						|| byte === 0x2c || byte === 0x2f || byte === 0x20;
					if (!valid) {
						const length = o - (lastInvalid + 1);
						if (length >= 6) found.push(latin1(lastInvalid + 1, length, dat));
						lastInvalid = o;
					}
				}

				lines.push(`${label}. ${found.join(', ')}`);
			};

			search('ARM9', fs.arm9);
			search('ARM7', fs.arm7);

			for (let i = 0; i * 0x20 < headers.ov9Size; ++i) search(String(i).padStart(4, '0'), fs.overlay(i, true));

			const downloadContent = lines.join('\n');
			downloadButton.style.display = '';
			downloadCallback = () => download(`${headers.gamecode}-strings.txt`, downloadContent);

			preview.innerHTML = `<ul style="font-family: 'Red Hat Mono'">${lines.map(x => `<li>${x}</li>`).join('')}</ul>`;
		};

		const update = () => {
			preview.innerHTML = '';
			preview.style.height = '';
			downloadButton.style.display = 'none';

			if (mode.value === 0) updateRamArrangement();
			else if (mode.value === 1) updateOverlayEntries();
			else if (mode.value === 2) updateStringSearch();
		};
		update();

		return ovt;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System (Extended)                                                                               |
	// +---------------------------------------------------------------------------------------------------------------+

	const fsext = (window.fsext = createSection('File System (Extended)', (section) => {
		const fsext = {};

		const varLengthSegments = (fsext.varLengthSegments = (start, dat, segmentsDat) => {
			const chunkLength = dat.getUint32(start, true);
			const offsets = [];
			const segments = [];
			for (let o = 4; o < chunkLength; o += 4) {
				offsets.push(dat.getInt32(start + o, true));
				if (!segmentsDat || offsets.length < 2) continue;
				segments.push(sliceDataView(segmentsDat, offsets[offsets.length - 2], offsets[offsets.length - 1]));
			}

			if (segmentsDat)
				segments.push(sliceDataView(segmentsDat, offsets[offsets.length - 1], segmentsDat.byteLength));

			return { offsets, segments };
		});

		const fixedIndices = (fsext.fixedIndices = (o, end, dat) => {
			const indices = [];
			for (; o < end; o += 4) indices.push(dat.getInt32(o, true));
			return indices;
		});

		const fixedSegments = (fsext.fixedSegments = (o, end, size, dat) => {
			const segments = [];
			for (; o < end; o += size) segments.push(sliceDataView(dat, o, o + size));
			return segments;
		});

		// i'm not sure how these file structures work, but this should cover all versions of MLBIS
		// you can find these offsets yourself by going through overlay 0x03, which has lists of increasing
		// pointers into each file. these pointers stop right before the end of the file length, so it's easy to tell
		// which pointer list belongs to which file
		// (for example, in NA /FMap/FMapData.dat has length 0x1a84600 and the last pointer is 0x1a84530)
		if (headers.gamecode === 'CLJE') {
			// NA
			fsext.bai_item_ji = varLengthSegments(0x7c6c, fs.overlay(14), fs.get('/BAI/BAI_item_ji.dat')); // ?
			fsext.blfxtex = varLengthSegments(0x7c78, fs.overlay(14), fs.get('/BRfx/BLfxTex.dat')); // ?
			fsext.bai_scn_cf = varLengthSegments(0x7c84, fs.overlay(14), fs.get('/BAI/BAI_scn_cf.dat')); // ?
			fsext.bofxtex = varLengthSegments(0x7c90, fs.overlay(14), fs.get('/BRfx/BOfxTex.dat'));
			fsext.bofxpal = varLengthSegments(0x7ca8, fs.overlay(14), fs.get('/BRfx/BOfxPal.dat'));
			fsext.bmapg = varLengthSegments(0x7cc0, fs.overlay(14), fs.get('/BMapG/BMapG.dat'));
			fsext.bdfxtex = varLengthSegments(0x7cd8, fs.overlay(14), fs.get('/BRfx/BDfxTex.dat'));
			fsext.bdfxpal = varLengthSegments(0x7d0c, fs.overlay(14), fs.get('/BRfx/BDfxPal.dat'));
			fsext.bai_atk_yy = varLengthSegments(0x7d40, fs.overlay(14), fs.get('/BAI/BAI_atk_yy.dat'));
			fsext.bai_mon_cf = varLengthSegments(0x7d7c, fs.overlay(14), fs.get('/BAI/BAI_mon_cf.dat'));
			fsext.bai_mon_yo = varLengthSegments(0x8210, fs.overlay(14), fs.get('/BAI/BAI_mon_yo.dat'));
			fsext.bai_scn_ji = varLengthSegments(0x82a4, fs.overlay(14), fs.get('/BAI/BAI_scn_ji.dat'));
			fsext.bai_atk_nh = varLengthSegments(0x834c, fs.overlay(14), fs.get('/BAI/BAI_atk_nh.dat'));
			fsext.bai_mon_ji = varLengthSegments(0x8480, fs.overlay(14), fs.get('/BAI/BAI_mon_ji.dat'));
			fsext.bobjmap = varLengthSegments(0x859c, fs.overlay(14));
			fsext.bai_atk_hk = varLengthSegments(0x875c, fs.overlay(14), fs.get('/BAI/BAI_atk_hk.dat'));
			fsext.bai_scn_yo = varLengthSegments(0x8998, fs.overlay(14), fs.get('/BAI/BAI_scn_yo.dat'));
			fsext.bobjpc = varLengthSegments(0x8c1c, fs.overlay(14));
			fsext.bobjui = varLengthSegments(0x91c0, fs.overlay(14));
			fsext.bobjmon = varLengthSegments(0x9c18, fs.overlay(14));

			fsext.baiCommands = fixedSegments(0x13478, 0x156b8, 16, fs.overlay(12));
			fsext.monsters = fixedSegments(0xe074, 0xf448, 36, fs.overlay(11));

			fsext.fevent = varLengthSegments(0xc8ac, fs.overlay(3), fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = varLengthSegments(0x11310, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));

			// fsext.fdfxtex = varLengthSegments(0x5ca54, fs.overlay(4), fs.get('/FRfx/FDfxTex.dat')); // TODO WRONG ALIGNMENT
			// TODO: check at 0x4e380, seems like offsets but not varLengthSegments
			fsext.fdfxpal = varLengthSegments(0x4a82c, fs.overlay(4), fs.get('/FRfx/FDfxPal.dat'));
			fsext.fdfxtex = varLengthSegments(0x4a628, fs.overlay(4), fs.get('/FRfx/FDfxTex.dat'));
			fsext.fofxpal = varLengthSegments(0x4a4fc, fs.overlay(4), fs.get('/FRfx/FOfxPal.dat'));
			fsext.fofxtex = varLengthSegments(0x4a3d0, fs.overlay(4), fs.get('/FRfx/FOfxTex.dat'));


			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fobjPalettes = fixedSegments(0x150c8, 0x15854, 4, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d3c, 0x464cc);
		} else if (headers.gamecode === 'CLJK') {
			// KO
			fsext.bai_item_ji = varLengthSegments(0x7c6c, fs.overlay(14), fs.get('/BAI/BAI_item_ji.dat')); // ?
			fsext.blfxtex = varLengthSegments(0x7c78, fs.overlay(14), fs.get('/BRfx/BLfxTex.dat')); // ?
			fsext.bai_scn_cf = varLengthSegments(0x7c84, fs.overlay(14), fs.get('/BAI/BAI_scn_cf.dat')); // ?
			fsext.bofxtex = varLengthSegments(0x7c90, fs.overlay(14), fs.get('/BRfx/BOfxTex.dat'));
			fsext.bofxpal = varLengthSegments(0x7ca8, fs.overlay(14), fs.get('/BRfx/BOfxTex.dat'));
			fsext.bmapg = varLengthSegments(0x7cc0, fs.overlay(14), fs.get('/BMapG/BMapG.dat'));
			fsext.bdfxtex = varLengthSegments(0x7cd8, fs.overlay(14), fs.get('/BRfx/BDfxTex.dat'));
			fsext.bdfxpal = varLengthSegments(0x7d0c, fs.overlay(14), fs.get('/BRfx/BDfxPal.dat'));
			fsext.bai_atk_yy = varLengthSegments(0x7d40, fs.overlay(14), fs.get('/BAI/BAI_atk_yy.dat'));
			fsext.bai_mon_cf = varLengthSegments(0x7d7c, fs.overlay(14), fs.get('/BAI/BAI_mon_cf.dat'));
			fsext.bai_mon_yo = varLengthSegments(0x8210, fs.overlay(14), fs.get('/BAI/BAI_mon_yo.dat'));
			fsext.bai_scn_ji = varLengthSegments(0x82a4, fs.overlay(14), fs.get('/BAI/BAI_scn_ji.dat'));
			fsext.bai_atk_nh = varLengthSegments(0x834c, fs.overlay(14), fs.get('/BAI/BAI_atk_nh.dat'));
			fsext.bai_mon_ji = varLengthSegments(0x8480, fs.overlay(14), fs.get('/BAI/BAI_mon_ji.dat'));
			fsext.bobjmap = varLengthSegments(0x859c, fs.overlay(14));
			fsext.bai_atk_hk = varLengthSegments(0x875c, fs.overlay(14), fs.get('/BAI/BAI_atk_hk.dat'));
			fsext.bai_scn_yo = varLengthSegments(0x8998, fs.overlay(14), fs.get('/BAI/BAI_scn_yo.dat'));
			fsext.bobjpc = varLengthSegments(0x8c1c, fs.overlay(14));
			fsext.bobjui = varLengthSegments(0x91c0, fs.overlay(14));
			fsext.bobjmon = varLengthSegments(0x9c18, fs.overlay(14));

			fsext.baiCommands = fixedSegments(0x13478, 0x156b8, 16, fs.overlay(12));
			fsext.monsters = fixedSegments(0x17098, 0x1846c, 36, fs.overlay(11));

			fsext.fevent = varLengthSegments(0xc8ac, fs.overlay(3), fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = varLengthSegments(0x11310, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d90, 0x462d8);
		} else if (headers.gamecode === 'CLJJ') {
			// JP/ROC
			fsext.bai_scn_cf = varLengthSegments(0x540d0, fs.overlay(11), fs.get('/BAI/BAI_scn_cf.dat'));
			fsext.bai_item_ji = varLengthSegments(0x540dc, fs.overlay(11), fs.get('/BAI/BAI_item_ji.dat'));
			fsext.blfxtex = varLengthSegments(0x540e8, fs.overlay(11), fs.get('/BRfx/BLfxTex.dat'));
			fsext.bofxtex = varLengthSegments(0x540f4, fs.overlay(11), fs.get('/BRfx/BOfxTex.dat'));
			fsext.bofxpal = varLengthSegments(0x5410c, fs.overlay(11), fs.get('/BRfx/BOfxPal.dat'));
			fsext.bmapg = varLengthSegments(0x54124, fs.overlay(11), fs.get('/BMapG/BMapG.dat'));
			fsext.bdfxtex = varLengthSegments(0x5413c, fs.overlay(11), fs.get('/BRfx/BDfxTex.dat'));
			fsext.bdfxpal = varLengthSegments(0x54170, fs.overlay(11), fs.get('/BRfx/BDfxPal.dat'));
			fsext.bai_mon_cf = varLengthSegments(0x541a4, fs.overlay(11), fs.get('/BAI/BAI_mon_cf.dat'));
			fsext.bai_atk_yy = varLengthSegments(0x541e0, fs.overlay(11), fs.get('/BAI/BAI_atk_yy.dat'));
			fsext.bai_mon_yo = varLengthSegments(0x54664, fs.overlay(11), fs.get('/BAI/BAI_mon_yo.dat'));
			fsext.bai_scn_ji = varLengthSegments(0x546f8, fs.overlay(11), fs.get('/BAI/BAI_scn_ji.dat'));
			fsext.bai_atk_nh = varLengthSegments(0x54834, fs.overlay(11), fs.get('/BAI/BAI_atk_nh.dat'));
			fsext.bai_mon_ji = varLengthSegments(0x548cc, fs.overlay(11), fs.get('/BAI/BAI_mon_ji.dat'));
			fsext.bobjmap = varLengthSegments(0x549e8, fs.overlay(11));
			fsext.bai_atk_hk = varLengthSegments(0x54ba8, fs.overlay(11), fs.get('/BAI/BAI_atk_hk.dat'));
			fsext.bai_scn_yo = varLengthSegments(0x54de4, fs.overlay(11), fs.get('/BAI/BAI_scn_yo.dat'));
			fsext.bobjpc = varLengthSegments(0x55068, fs.overlay(11));
			fsext.bobjui = varLengthSegments(0x5560c, fs.overlay(11));
			fsext.bobjmon = varLengthSegments(0x56b30, fs.overlay(11));

			fsext.baiCommands = fixedSegments(0x41bc4, 0x43df0, 16, fs.overlay(11));
			fsext.monsters = fixedSegments(0x52cd4, 0x540a8, 36, fs.overlay(11));

			fsext.fevent = varLengthSegments(0xcb18, fs.overlay(3), fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = varLengthSegments(0x11544, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xeb0c, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xbca8, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xc01c, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xbb0c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x9b00, 0x9b00 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x19710, 0x1a85c, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x1a85c, 0x1dd90, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x44fa8, 0x48084);
		} else if (headers.gamecode === 'CLJP') {
			// EU
			fsext.bai_item_ji = varLengthSegments(0x7c6c, fs.overlay(14), fs.get('/BAI/BAI_item_ji.dat')); // ?
			fsext.blfxtex = varLengthSegments(0x7c78, fs.overlay(14), fs.get('/BRfx/BLfxTex.dat')); // ?
			fsext.bai_scn_cf = varLengthSegments(0x7c84, fs.overlay(14), fs.get('/BAI/BAI_scn_cf.dat')); // ?
			fsext.bofxtex = varLengthSegments(0x7c90, fs.overlay(14), fs.get('/BRfx/BOfxTex.dat'));
			fsext.bofxpal = varLengthSegments(0x7ca8, fs.overlay(14), fs.get('/BRfx/BOfxTex.dat'));
			fsext.bmapg = varLengthSegments(0x7cc0, fs.overlay(14), fs.get('/BMapG/BMapG.dat'));
			fsext.bdfxtex = varLengthSegments(0x7cd8, fs.overlay(14), fs.get('/BRfx/BDfxTex.dat'));
			fsext.bdfxpal = varLengthSegments(0x7d0c, fs.overlay(14), fs.get('/BRfx/BDfxPal.dat'));
			fsext.bai_atk_yy = varLengthSegments(0x7d40, fs.overlay(14), fs.get('/BAI/BAI_atk_yy.dat'));
			fsext.bai_mon_cf = varLengthSegments(0x7d7c, fs.overlay(14), fs.get('/BAI/BAI_mon_cf.dat'));
			fsext.bai_mon_yo = varLengthSegments(0x8210, fs.overlay(14), fs.get('/BAI/BAI_mon_yo.dat'));
			fsext.bai_scn_ji = varLengthSegments(0x82a4, fs.overlay(14), fs.get('/BAI/BAI_scn_ji.dat'));
			fsext.bai_atk_nh = varLengthSegments(0x834c, fs.overlay(14), fs.get('/BAI/BAI_atk_nh.dat'));
			fsext.bai_mon_ji = varLengthSegments(0x8480, fs.overlay(14), fs.get('/BAI/BAI_mon_ji.dat'));
			fsext.bobjmap = varLengthSegments(0x859c, fs.overlay(14));
			fsext.bai_atk_hk = varLengthSegments(0x875c, fs.overlay(14), fs.get('/BAI/BAI_atk_hk.dat'));
			fsext.bai_scn_yo = varLengthSegments(0x8998, fs.overlay(14), fs.get('/BAI/BAI_scn_yo.dat'));
			fsext.bobjpc = varLengthSegments(0x8c1c, fs.overlay(14));
			fsext.bobjui = varLengthSegments(0x91c0, fs.overlay(14));
			fsext.bobjmon = varLengthSegments(0x9c18, fs.overlay(14));

			fsext.baiCommands = fixedSegments(0x13478, 0x156b8, 16, fs.overlay(12));
			fsext.monsters = fixedSegments(0xe074, 0xf448, 36, fs.overlay(11));

			fsext.fevent = varLengthSegments(0xc8ac, fs.overlay(3), fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = varLengthSegments(0x11310, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d3c, 0x464cc);
		} else if (headers.gamecode === 'Y6PP') {
			// EU Demo
			// TODO battle offsets here. and then actually test the battle offsets and make sure they work on mlbis-dumper
			fsext.bai_scn_cf = varLengthSegments(0x48cbc, fs.overlay(11), fs.get('/BAI/BAI_scn_cf.dat'));
			fsext.bai_item_ji = varLengthSegments(0x48cc8, fs.overlay(11), fs.get('/BAI/BAI_item_ji.dat'));
			fsext.bofxtex = varLengthSegments(0x48cd4, fs.overlay(11), fs.get('/BRfx/BOfxTex.dat'));
			fsext.bofxpal = varLengthSegments(0x48cec, fs.overlay(11), fs.get('/BRfx/BOfxPal.dat'));
			fsext.bdfxtex = varLengthSegments(0x48d04, fs.overlay(11), fs.get('/BRfx/BDfxTex.dat'));
			fsext.bdfxpal = varLengthSegments(0x48d38, fs.overlay(11), fs.get('/BRfx/BDfxPal.dat'));
			fsext.bai_mon_cf = varLengthSegments(0x48d6c, fs.overlay(11), fs.get('/BAI/BAI_mon_cf.dat'));
			fsext.bai_atk_yy = varLengthSegments(0x48da8, fs.overlay(11), fs.get('/BAI/BAI_atk_yy.dat'));
			fsext.bai_mon_yo = varLengthSegments(0x49170, fs.overlay(11), fs.get('/BAI/BAI_mon_yo.dat'));
			fsext.bai_scn_ji = varLengthSegments(0x49204, fs.overlay(11), fs.get('/BAI/BAI_scn_ji.dat'));
			fsext.bai_atk_nh = varLengthSegments(0x49340, fs.overlay(11), fs.get('/BAI/BAI_atk_nh.dat'));
			fsext.bai_mon_ji = varLengthSegments(0x493d8, fs.overlay(11), fs.get('/BAI/BAI_mon_ji.dat'));
			fsext.bobjmap = varLengthSegments(0x494f4, fs.overlay(11));
			fsext.bai_atk_hk = varLengthSegments(0x496b4, fs.overlay(11), fs.get('/BAI/BAI_atk_hk.dat'));
			fsext.bai_scn_yo = varLengthSegments(0x498f0, fs.overlay(11), fs.get('/BAI/BAI_scn_yo.dat'));
			fsext.bobjpc = varLengthSegments(0x49b74, fs.overlay(11));
			fsext.bobjui = varLengthSegments(0x4a118, fs.overlay(11));
			fsext.bobjmon = varLengthSegments(0x4b63c, fs.overlay(11));

			fsext.baiCommands = fixedSegments(0x3a98c, 0x3cbbc, 16, fs.overlay(11));
			fsext.monsters = fixedSegments(0x478cc, 0x48c94, 36, fs.overlay(11));

			fsext.fevent = varLengthSegments(0x94c8, fs.overlay(3), fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = varLengthSegments(0x9a3c, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0x9cb0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0x965c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe220, 0xe318, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe498, 0xe72c, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x406d0, 0x42e60);
		} else if (headers.gamecode === 'Y6PE') {
			// NA Demo
			fsext.blfxtex = varLengthSegments(0x48bf0, fs.overlay(11)); // ?
			fsext.bai_scn_cf = varLengthSegments(0x48bfc, fs.overlay(11), fs.get('/BAI/BAI_scn_cf.dat'));
			fsext.bai_item_ji = varLengthSegments(0x48c08, fs.overlay(11), fs.get('/BAI/BAI_item_ji.dat'));
			fsext.bofxtex = varLengthSegments(0x48c14, fs.overlay(11));
			fsext.bofxpal = varLengthSegments(0x48c2c, fs.overlay(11));
			fsext.bdfxtex = varLengthSegments(0x48c44, fs.overlay(11));
			fsext.bdfxpal = varLengthSegments(0x48c78, fs.overlay(11));
			fsext.bai_mon_cf = varLengthSegments(0x48cac, fs.overlay(11), fs.get('/BAI/BAI_mon_cf.dat'));
			fsext.bai_atk_yy = varLengthSegments(0x48ce8, fs.overlay(11), fs.get('/BAI/BAI_atk_yy.dat'));
			fsext.bai_mon_yo = varLengthSegments(0x490b0, fs.overlay(11), fs.get('/BAI/BAI_mon_yo.dat'));
			fsext.bai_scn_ji = varLengthSegments(0x49144, fs.overlay(11), fs.get('/BAI/BAI_scn_ji.dat'));
			fsext.bai_atk_nh = varLengthSegments(0x49280, fs.overlay(11), fs.get('/BAI/BAI_atk_nh.dat'));
			fsext.bai_mon_ji = varLengthSegments(0x49318, fs.overlay(11), fs.get('/BAI/BAI_mon_ji.dat'));
			fsext.bobjmap = varLengthSegments(0x49434, fs.overlay(11));
			fsext.bai_atk_hk = varLengthSegments(0x495f4, fs.overlay(11), fs.get('/BAI/BAI_atk_hk.dat'));
			fsext.bai_scn_yo = varLengthSegments(0x49830, fs.overlay(11), fs.get('/BAI/BAI_scn_yo.dat'));
			fsext.bobjpc = varLengthSegments(0x49ab4, fs.overlay(11));
			fsext.bobjui = varLengthSegments(0x4a058, fs.overlay(11));
			fsext.bobjmon = varLengthSegments(0x4b57c, fs.overlay(11));

			fsext.baiCommands = fixedSegments(0x3a98c, 0x3cbbc, 16, fs.overlay(11));
			fsext.monsters = fixedSegments(0x4780c, 0x48be0, 36, fs.overlay(11));

			fsext.fevent = varLengthSegments(0x94c8, fs.overlay(3), fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = varLengthSegments(0x9a3c, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0x9cb0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0x965c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe164, 0xe25c, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe3dc, 0xe670, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x4071c, 0x42cc8);
		} else {
			addHTML(section, `<b style="color: var(--red);">Unknown gamecode ${headers.gamecode}</b>`);
		}

		return fsext;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Field Palette Animations                                                                             |
	// +---------------------------------------------------------------------------------------------------------------+

	const fpaf = (window.fpaf = createSection('Field Palette Animations', (section) => {
		const fpaf = {};

		const table = document.createElement('table');
		table.style.cssText = 'border-collapse: collapse;';
		section.appendChild(table);

		fpaf.apply = (palette, segments, tick) => {
			if (!segments.length) return;

			const segment = bufToS16(segments[0]); // other segments appear to be ignored
			let o = 0;
			const totalLength = segment[o++];
			while (o < segment.length) {
				let blendMode,
					paletteStart,
					paletteLength,
					red = 0,
					green = 0,
					blue = 0;
				let keyframe,
					keyframeDistance,
					keyframes = 0,
					percent = 0;

				let relativeTick = tick % totalLength;

				commandLoop: while (o < segment.length) {
					const command = segment[o] & 0xff;
					const params = segment[o++] >> 8;

					// these are listed in the order they come in by default, but you can rearrange things
					if (command === 0x82)
						++o; // unknown, always zero
					else if (command === 0x00)
						paletteStart = segment[o++]; // (source)
					else if (command === 0x01) paletteLength = segment[o++];
					else if (command === 0x02)
						++o; // paletteTo (destination)
					else if (command === 0x83)
						++o; // color keyframe lengths (TODO)
					else if (command === 0x1c)
						red = segment[o++] & 0x1f; // 0x00 - 0x1f
					else if (command === 0x1d)
						green = segment[o++] & 0x1f; // 0x00 - 0x1f
					else if (command === 0x1e)
						blue = segment[o++] & 0x1f; // 0x00 - 0x1f
					else if (4 <= command && command <= 0xa) {
						// TODO: are there more?
						// keyframe lengths
						blendMode = command;
						let startTick = 0;
						keyframes = params / 2 + 1;
						for (let i = 0; i < keyframes; ++i) {
							const length = segment[o++];
							if (relativeTick < length && keyframe === undefined) {
								keyframe = i;
								keyframeDistance = relativeTick / length;
							}
							relativeTick -= length;
						}
					} else if (command === 0x1f) {
						// keyframe values (0 - 100)
						let from = 0,
							to = 0;
						if (keyframe !== undefined) {
							from = keyframe === 0 ? 0 : segment[o + keyframe - 1];
							to = segment[o + keyframe];
							percent = Math.min(100, from + (to - from) * keyframeDistance);
						}
						o += keyframes;
						break commandLoop;
					} else {
						throw `unknown command 0x${str8(command)} params 0x${str8(params)}`;
					}
				}

				// apply to palette
				if (blendMode === 4) {
					// palette rotate
					const old = new Uint32Array(paletteLength);
					old.set(palette.slice(paletteStart, paletteStart + paletteLength), 0);
					for (let j = 0; j < paletteLength; ++j) {
						palette[paletteStart + j] = old[(j + ~~((percent / 100) * paletteLength)) % paletteLength];
					}
				} else if (blendMode === 5) {
					// set
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r = ((palette[j] & 0xf8) * (100 - percent)) / 100 + ((red << 3) * percent) / 100;
						const g = (((palette[j] >> 8) & 0xf8) * (100 - percent)) / 100 + ((green << 3) * percent) / 100;
						const b = (((palette[j] >> 16) & 0xf8) * (100 - percent)) / 100 + ((blue << 3) * percent) / 100;
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 6) {
					// additive
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r = Math.min(0xf8, (palette[j] & 0xf8) + ((red << 3) * percent) / 100);
						const g = Math.min(0xf8, ((palette[j] >> 8) & 0xf8) + ((green << 3) * percent) / 100);
						const b = Math.min(0xf8, ((palette[j] >> 16) & 0xf8) + ((blue << 3) * percent) / 100);
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 7) {
					// subtractive
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r = Math.max(0, (palette[j] & 0xf8) - ((red << 3) * percent) / 100);
						const g = Math.max(0, ((palette[j] >> 8) & 0xf8) - ((green << 3) * percent) / 100);
						const b = Math.max(0, ((palette[j] >> 16) & 0xf8) - ((blue << 3) * percent) / 100);
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 8) {
					// set dimmed (not really sure why this exists)
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r =
							((palette[j] & 0xf8) * (100 - percent)) / 100 +
							((((red / 0x1f) * 0x16) << 3) * percent) / 100;
						const g =
							(((palette[j] >> 8) & 0xf8) * (100 - percent)) / 100 +
							((((green / 0x1f) * 0x16) << 3) * percent) / 100;
						const b =
							(((palette[j] >> 16) & 0xf8) * (100 - percent)) / 100 +
							((((blue / 0x1f) * 0x16) << 3) * percent) / 100;
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 9) {
					// invert
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						let r = palette[j] & 0xf8;
						let g = (palette[j] >> 8) & 0xf8;
						let b = (palette[j] >> 16) & 0xf8;
						r += ((0xf8 - r * 2) * percent) / 100;
						g += ((0xf8 - g * 2) * percent) / 100;
						b += ((0xf8 - b * 2) * percent) / 100;
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				}
			}

			// make RGB15 brighter (so 0x1f in 5-bit corresponds to 0xff in 8-bit)
			for (let i = 0; i < 256; ++i) {
				palette[i] &= 0xfff8f8f8;
				palette[i] |= (palette[i] >> 5) & 0x070707;
			}
		};

		fpaf.stringify = (segments) => {
			if (!segments.length) return [];
			const segment = bufToU16(segments[0]);
			let o = 0;
			const totalLength = segment[o++];
			const strings = [`(totalLength ${totalLength})`];
			while (o < segment.length) {
				let parts = [];

				let colors = 0;
				let keyframes = 0;
				commandLoop: while (o < segment.length) {
					const command = segment[o] & 0xff;
					const params = segment[o++] >> 8;
					const commandStr = params ? str16(command | (params << 8)) : str8(command);

					if (command === 0x82) {
						(parts.push(`(palette 0x${str16(segment[o++])})`), (o += params));
					} else if (command === 0x00) {
						parts.push(`(palFrom 0x${str8(segment[o++])})`);
					} else if (command === 0x01) {
						parts.push(`(palLen 0x${str8(segment[o++])})`);
					} else if (command === 0x02) {
						parts.push(`(palTo 0x${str8(segment[o++])})`);
					} else if (command === 0x83) {
						const unknown = [];
						colors = params / 2 + 1;
						for (let i = 0; i < colors; ++i) unknown.push(segment[o++]);
						parts.push(`(color lengths ${unknown.join(' ')})`);
					} else if (command === 0x1c) {
						const reds = [];
						for (let i = 0; i < colors; ++i) reds.push('0x' + str8(segment[o++]));
						parts.push(`(red${params ? '[' + params + ']' : ''} ${reds.join(' ')})`);
					} else if (command === 0x1d) {
						const greens = [];
						for (let i = 0; i < colors; ++i) greens.push('0x' + str8(segment[o++]));
						parts.push(`(green${params ? '[' + params + ']' : ''} ${greens.join(' ')})`);
					} else if (command === 0x1e) {
						const blues = [];
						for (let i = 0; i < colors; ++i) blues.push('0x' + str8(segment[o++]));
						parts.push(`(blue${params ? '[' + params + ']' : ''} ${blues.join(' ')})`);
					} else if (4 <= command && command <= 0xa) {
						const mode =
							['ROTATE', 'SET', 'ADD', 'SUB', 'SET_DIMMED', 'INVERT'][command - 4] ??
							'0x' + str8(command);
						const lengths = [];
						keyframes = params / 2 + 1;
						for (let i = 0; i < keyframes; ++i) lengths.push(segment[o++]);
						parts.push(`(${mode} lengths ${lengths.join(' ')})`);
					} else if (command === 0x1f || command === 0x1b) {
						const percents = [];
						for (let i = 0; i < keyframes; ++i) percents.push(segment[o++] + '%');
						parts.push(`(values[${params}] ${percents.join(' ')})`);
						break commandLoop;
					} else {
						parts.push(`(0x${commandStr} 0x${str16(segment[o++] ?? 0)})`);
						console.warn(`unknown command 0x${commandStr}`);
					}
				}

				strings.push(
					parts.map((s, i) => `<span style="color: var(${i % 2 ? '--fg-dim' : '--fg'});">${s}</span>`).join(' '),
				);
			}

			return strings;
		};

		for (let i = 0; i < fsext.fpaf.segments.length - 1; ++i) {
			const s = unpackSegmented16(fsext.fpaf.segments[i]);
			addHTML(
				table,
				`<tr style="${i < fsext.fpaf.segments.length - 2 ? 'border-bottom: 1px solid var(--line);' : ''}">
			<td><code>${i}</code></td>
			<td style="padding: 10px 0;"><ul>${fpaf
				.stringify(s)
				.map((x) => '<li><code>' + x + '</code></li>')
				.join('')}</ul></td>
		</tr>`,
			);
		}

		return fpaf;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Field Maps                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initField) await waitFor(() => window.initField);
	window.initField();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: FMapData Tile Viewer                                                                                 |
	// +---------------------------------------------------------------------------------------------------------------+

	const fmapdataTiles = (window.fmapdataTiles = createSection('FMapData Tile Viewer', (section) => {
		const fmapdataTiles = {};
		const fieldFile = fs.get('/FMap/FMapData.dat');

		const options = [];
		for (let i = 0; i < fsext.fieldAnimeIndices[0]; ++i) options.push(`FMapData ${i.toString(16)}`);
		for (let i = 0; i < fsext.fieldAnimeIndices.length; ++i)
			options.push(`FMapData ${fsext.fieldAnimeIndices[i].toString(16)} (Anime ${i.toString(16)})`);
		const select = dropdown(options, 0, () => update());

		section.appendChild(select);

		const dump = document.createElement('button');
		dump.textContent = 'Dump';
		dump.addEventListener('click', () => {
			const index = select.value;
			const data = lzBis(fsext.fmapdata.segments[index]);
			download(`FMapData-${index.toString(16)}.bin`, data.buffer);
		});
		section.appendChild(dump);

		// generate a rainbow color palette, with later values using darker colors (0 - 0xf instead of 0 - 0x1f)
		const globalPalette256 = (fmapdataTiles.globalPalette256 = new DataView(new ArrayBuffer(512)));
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(i * 2, (0x1f << 10) | (i << 5) | 0, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x40 + i * 2, (i << 10) | (0x1f << 5) | 0, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x80 + i * 2, (0 << 10) | (0x1f << 5) | i, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0xc0 + i * 2, (0 << 10) | (i << 5) | 0x1f, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x100 + i * 2, (i << 10) | (0 << 5) | 0x1f, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x140 + i * 2, (0x1f << 10) | (0 << 5) | i, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x180 + i * 2, (0xf << 10) | (i << 5) | 0, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1a0 + i * 2, (i << 10) | (0xf << 5) | 0, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x1c0 + i * 2, 0 | (0xf << 5) | i, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1e0 + i * 2, 0 | (i << 5) | 0xf, true);

		const globalPalette16 = (fmapdataTiles.globalPalette16 = new DataView(new ArrayBuffer(512)));
		const rgb15s = [
			[31, 0, 0],
			[31, 10, 0],
			[31, 20, 0],
			[31, 31, 0],
			[20, 31, 0],
			[10, 31, 0],
			[0, 31, 0],
			[0, 31, 10],
			[0, 31, 20],
			[0, 31, 31],
			[0, 20, 31],
			[0, 10, 31],
			[0, 0, 31],
			[10, 0, 31],
			[20, 0, 31],
			[31, 0, 31],
		];
		for (let i = 0; i < 16; ++i) {
			const [b, g, r] = rgb15s[i];
			const rgb15 = (r << 10) | (g << 5) | b;
			for (let o = 0; o < 512; o += 32) globalPalette16.setUint16(o + i * 2, rgb15, true);
		}

		let paletteSelectPlaceholder = document.createElement('button');
		paletteSelectPlaceholder.textContent = 'Find Palettes';
		section.appendChild(paletteSelectPlaceholder);

		const canvasContainer = document.createElement('div');
		canvasContainer.style.cssText = 'height: 640px; position: relative;';
		section.appendChild(canvasContainer);

		const tileCanvases256 = [];
		const tileCanvases16 = [];
		const paletteCanvases = [];
		for (let i = 0; i < 3; ++i) {
			const tc256 = document.createElement('canvas');
			tc256.width = tc256.height = 256;
			tc256.style.cssText = `position: absolute; top: 0px; left: ${i * 256}px; width: 256px; height: 256px;`;
			canvasContainer.appendChild(tc256);
			tileCanvases256.push(tc256);

			const tc16 = document.createElement('canvas');
			tc16.width = tc16.height = 256;
			tc16.style.cssText = `position: absolute; top: 256px; left: ${i * 256}px; width: 256px; height: 256px;`;
			canvasContainer.appendChild(tc16);
			tileCanvases16.push(tc16);
		}

		for (let i = 0; i < 6; ++i) {
			const pc = document.createElement('canvas');
			pc.width = pc.height = 16;
			pc.style.cssText = `position: absolute; top: 512px; left: ${i * 128}px; width: 128px; height: 128px;`;
			canvasContainer.appendChild(pc);
			paletteCanvases.push(pc);
		}

		const animeToProps = (fmapdataTiles.animeToProps = new Map());
		paletteSelectPlaceholder.addEventListener('mousedown', () => {
			for (let i = 0; i < field.rooms.length; ++i) {
				const props = unpackSegmented(lzBis(fsext.fmapdata.segments[field.rooms[i].props]));
				const passiveAnimations = unpackSegmented(props[10]);
				for (const passiveAnime of passiveAnimations) {
					const tileset = passiveAnime.getInt16(4, true);
					let arr = animeToProps.get(tileset) || [];
					arr.push(i);
					animeToProps.set(tileset, arr);
				}
			}
			update();
		});

		let paletteOptions = [];
		const update = () => {
			const animeId = select.value - fsext.fieldAnimeIndices[0];
			if (animeToProps.size) {
				if (animeId >= 0) {
					paletteOptions = animeToProps.get(animeId) || [];

					if (paletteOptions.length === 0) {
						const span = document.createElement('span');
						span.textContent = '(unused?)';
						paletteSelectPlaceholder.replaceWith(span);
						paletteSelectPlaceholder = span;
					} else {
						const select = dropdown(
							paletteOptions.map((x) => `Palette for Room 0x${x.toString(16)}`),
							0,
							() => render(),
						);
						paletteSelectPlaceholder.replaceWith(select);
						paletteSelectPlaceholder = select;
					}
				} else {
					paletteOptions = [];
					const placeholder = document.createElement('span');
					placeholder.textContent = '(global palette)';
					paletteSelectPlaceholder.replaceWith(placeholder);
					paletteSelectPlaceholder = placeholder;
				}
			}

			render();
		};

		const render = () => {
			const index = select.value;
			const data = lzBis(fsext.fmapdata.segments[index]);

			let palettes = [
				globalPalette256,
				globalPalette16,
				globalPalette256,
				globalPalette16,
				globalPalette256,
				globalPalette16,
			];
			if (paletteOptions.length) {
				const roomIndex = paletteOptions[paletteSelectPlaceholder.value];
				const room = field.rooms[roomIndex];
				const props = unpackSegmented(lzBis(fsext.fmapdata.segments[room.props]));
				palettes = [props[3], props[3], props[4], props[4], props[5], props[5]];
			}

			// 256-color
			const bitmap256 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases256[i].getContext('2d');
				if (palettes[i * 2].byteLength !== 512) {
					// if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; ++k) {
						const pos = basePos | ((k >> 3) << 8) | (k & 0x7);
						const paletteIndex = data.getUint8(o++);
						writeRgb16(bitmap256, pos, palettes[i * 2].getUint16(paletteIndex * 2, true));
					}
				}

				ctx.putImageData(new ImageData(bitmap256, 256, 256), 0, 0);
			}

			// 16-color
			const bitmap16 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases16[i].getContext('2d');
				if (palettes[i * 2 + 1].byteLength !== 512) {
					// if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y = j >> 5, x = j & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; k += 2) {
						const pos = basePos | ((k >> 3) << 8) | (k & 0x7);
						const composite = data.getUint8(o++);
						writeRgb16(bitmap16, pos, palettes[i * 2 + 1].getUint16((composite & 0xf) * 2, true));
						writeRgb16(bitmap16, pos ^ 1, palettes[i * 2 + 1].getUint16((composite >> 4) * 2, true));
					}
				}

				ctx.putImageData(new ImageData(bitmap16, 256, 256), 0, 0);
			}

			// palettes
			const bitmapPal = new Uint8ClampedArray(256 * 4);
			for (let i = 0; i < 6; ++i) {
				const ctx = paletteCanvases[i].getContext('2d');
				if (palettes[i].byteLength !== 512) {
					ctx.clearRect(0, 0, 16, 16);
					continue;
				}

				for (let j = 0; j < 256; ++j) writeRgb16(bitmapPal, j, palettes[i].getUint16(j * 2, true));
				ctx.putImageData(new ImageData(bitmapPal, 16, 16), 0, 0);
			}
		};
		update();

		return fmapdataTiles;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Battle Maps                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const battle = (window.battle = createSection('Battle Maps', (section) => {
		const battle = {};

		const bmapFile = fs.get('/BMap/BMap.dat');
		const bmap = (battle.bmap = unpackSegmented(bmapFile));

		const bmaps = (battle.bmaps = []);
		for (let i = 1; i < bmap.length; i += 8) {
			bmaps.push({
				tileset: bmap[i],
				palette: bmap[i + 1],
				tilemaps: [bmap[i + 2], bmap[i + 3], bmap[i + 4]],
				paletteAnimations: bmap[i + 5],
				tileAnimations: bmap[i + 6],
				tilesetAnimated: bmap[i + 7],
			});
		}

		const bmapDropdown = dropdown(
			bmaps.map((_, i) => `BMap 0x${i.toString(16)}`),
			0,
			() => update(),
		);
		section.appendChild(bmapDropdown);

		let updatePalette = false;
		let updateTileset = false;
		let updateTilesetAnimated = false;
		let updateMap = false;

		const options = {};
		options.bgChecks = [];
		section.appendChild(
			(options.bgChecks[0] = checkbox('BG1', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.bgChecks[1] = checkbox('BG2', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.bgChecks[2] = checkbox('BG3', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.reverseLayers = checkbox('Reverse Layers', false, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.margins = checkbox('Margins', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			button('Export PNG', () => {
				const pngFile = battle.png(
					bmapDropdown.value,
					options.bgChecks[0].checked,
					options.bgChecks[1].checked,
					options.bgChecks[2].checked,
					options.reverseLayers.checked,
					options.margins.checked,
				);
				download(`bmap-${str16(bmapDropdown.value)}.png`, pngFile, 'image/png');
			}),
		);
		section.appendChild(
			(options.paletteAnimations = checkbox('Palette Animations', true, () => {
				updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
			})),
		);
		section.appendChild(
			(options.tileAnimations = checkbox('Tile Animations', true, () => {
				updateTileset = updateMap = true;
			})),
		);

		const mapCanvas = document.createElement('canvas');
		mapCanvas.width = 512;
		mapCanvas.height = 256;
		section.appendChild(mapCanvas);

		const rawPreview = document.createElement('div');
		rawPreview.style.cssText = 'height: 256px; position: relative;';
		section.appendChild(rawPreview);

		const tilesetCanvas = document.createElement('canvas');
		tilesetCanvas.style.cssText = 'height: 256px; width: 256px; position: absolute; top: 0px; left: 0px;';
		tilesetCanvas.width = tilesetCanvas.height = 256;
		rawPreview.appendChild(tilesetCanvas);

		const tilesetAnimatedCanvas = document.createElement('canvas');
		tilesetAnimatedCanvas.style.cssText = 'height: 256px; width: 256px; position: absolute; top: 0; left: 256px;';
		tilesetAnimatedCanvas.width = tilesetAnimatedCanvas.height = 256;
		rawPreview.appendChild(tilesetAnimatedCanvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.style.cssText = 'height: 128px; width: 128px; position: absolute; top: 0px; left: 512px;';
		paletteCanvas.width = paletteCanvas.height = 16;
		rawPreview.appendChild(paletteCanvas);

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		let room = (battle.room = undefined);
		const update = () => {
			const rawRoom = bmaps[bmapDropdown.value];
			battle.room = room = {
				tileset: rawRoom.tileset?.byteLength ? bufToU8(lzBis(rawRoom.tileset)) : undefined,
				palette: rawRoom.palette?.byteLength ? rgb15To32(bufToU16(rawRoom.palette)) : undefined,
				tilemaps: rawRoom.tilemaps.map((x) => (x?.byteLength ? bufToU16(x) : undefined)),
				tilesetAnimated: rawRoom.tilesetAnimated?.byteLength
					? bufToU8(lzBis(rawRoom.tilesetAnimated))
					: undefined,
				paletteAnimations: rawRoom.paletteAnimations ? unpackSegmented16(rawRoom.paletteAnimations) : [],
			};

			// parse tile animations
			room.tileAnimations = [];
			const tileSegments = rawRoom.tileAnimations ? unpackSegmented16(rawRoom.tileAnimations) : [];
			for (let i = 0; i < tileSegments.length - 1; ++i) {
				const segment = bufToS16(tileSegments[i]);
				let tilesetStart;
				let tilesetAnimatedStart;
				let replacementLength;
				let keyframeIndices = [];
				let keyframeLengths = [];
				let totalLength = 0;
				const parts = [];

				let o = 1;
				while (o < segment.length) {
					const command = segment[o] & 0xff;
					const params = segment[o] >> 8;
					++o;

					switch (command) {
						case 0x41:
							tilesetStart = segment[o++];
							parts.push(`(tileStart 0x${tilesetStart.toString(16)})`);
							break;
						case 0x19:
							replacementLength = segment[o++];
							parts.push(`(tileLength 0x${replacementLength.toString(16)})`);
							break;
						case 0x1a:
							tilesetAnimatedStart = segment[o++];
							parts.push(`(tileAnimatedStart 0x${tilesetAnimatedStart.toString(16)})`);
							break;
						case 0x00:
							for (let j = 0; j <= params / 2; ++j) keyframeIndices.push(segment[o++]);
							parts.push(`(indices ${keyframeIndices.join(' ')})`);
							break;
						case 0x1b:
							for (let j = 0; j < keyframeIndices.length; ++j) {
								const length = segment[o++];
								totalLength += length;
								keyframeLengths.push(length);
							}
							parts.push(`(lengths ${keyframeLengths.join(' ')})`);
							break;
					}
				}

				room.tileAnimations.push({
					tilesetStart,
					tilesetAnimatedStart,
					replacementLength,
					keyframeIndices,
					keyframeLengths,
					totalLength,
					parts,
				});
			}

			// metadata below
			metaPreview.innerHTML = '';
			if (room.tileset) addHTML(metaPreview, `<div><code>[0]</code> tileset: 0x${Math.ceil(room.tileset.length / 32).toString(16)} tiles</div>`);
			else addHTML(metaPreview, '<div><code>[0]</code> tileset: none</div>');

			addHTML(metaPreview, `<div><code>[1]</code> palette: ${room.palette ? 'exists' : ''}</div>`);

			for (let layer = 0; layer < 3; ++layer) {
				const container = document.createElement('div');
				container.innerHTML = `<code>[${2 + layer}]</code> tilemaps[${layer}] (BG${layer + 1}): `;

				const tilemap = room.tilemaps[layer];
				if (tilemap?.byteLength) {
					const tilemapContainer = document.createElement('div');
					tilemapContainer.style.cssText = 'border: 1px solid var(--line); padding: 5px; display: none; overflow-x: scroll;';
					container.appendChild(checkbox('Tilemap', false, checked => {
						if (checked) {
							const lines = [];
							for (let y = 0, o = 0; y < 32; ++y) {
								const line = [];
								for (let x = 0; x < 64; ++x, ++o) {
									line.push(tilemap[o] ? str16(tilemap[o]) : '----');
								}
								lines.push(line.join(' '));
							}
							tilemapContainer.style.display = '';
							tilemapContainer.innerHTML = `<code style="white-space: pre;">${lines.join('\n')}</code>`;
						} else {
							tilemapContainer.style.display = 'none';
							tilemapContainer.innerHTML = '';
						}
					}));
					container.appendChild(tilemapContainer);
				}
				metaPreview.appendChild(container);
			}

			const palAnimLines = fpaf.stringify(room.paletteAnimations);
			addHTML(metaPreview, `<div><code>[5]</code> paletteAnimations: <ul>${palAnimLines.map((x) => '<li><code>' + x + '</code></li>').join('')}</ul></div>`);

			addHTML(metaPreview, `<div><code>[6]</code> tileAnimations: <ul>${room.tileAnimations.map((x) => {
				return ('<li><code>' +
					x.parts.map((s, i) => `<span style="color: var(${i % 2 ? '--fg-dim' : '--fg'});">${s}</span>`).join(' ') +
					'</code></li>');
			}).join('')}</ul></div>`);

			if (room.tilesetAnimated) {
				let tilesEnd = 0;
				for (const anim of room.tileAnimations) {
					const end =
						anim.tilesetAnimatedStart + anim.replacementLength * (Math.max(...anim.keyframeIndices) + 1);
					if (tilesEnd < end) tilesEnd = end;
				}
				let html = `<code>[7]</code> tilesetAnimated: 0x${tilesEnd} tiles`;
				if (tilesEnd * 32 < room.tilesetAnimated.byteLength) {
					html += `, debug info or unused tiles: <ul>
						<li style="overflow-wrap: anywhere;"><code>${latin1(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
						<li><code>${bytes(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
					</ul>`;
				}
				addHTML(metaPreview, `<div>${html}</div>`);
			} else {
				addHTML(metaPreview, '<div><code>[7]</code> tilesetAnimated:</div>');
			}

			updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
		};

		const palette = new Uint32Array(256);
		const render = () => {
			if (options.paletteAnimations.checked && room.paletteAnimations.length)
				updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
			if (options.tileAnimations.checked && room.tileAnimations.length) updateTileset = updateMap = true;
			const tick = Math.floor((performance.now() / 1000) * 60);

			// palette
			if (updatePalette) {
				const paletteCtx = paletteCanvas.getContext('2d');
				if (room.palette) {
					palette.set(room.palette, 0);
					if (options.paletteAnimations.checked) fpaf.apply(palette, room.paletteAnimations, tick);
					paletteCtx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
				} else {
					palette.fill(0, 0, 256);
					paletteCtx.clearRect(0, 0, 16, 16);
				}
			}

			if (updateTileset || updateTilesetAnimated || updateMap) {
				// tileset
				const layout = new Array(1024);
				const tilesetCtx = tilesetCanvas.getContext('2d');
				if (room.tileset) {
					for (let i = 0; i < 1024; ++i) layout[i] = room.tileset.slice(i * 32, i * 32 + 32);

					if (options.tileAnimations.checked) {
						for (let i = 0; i < room.tileAnimations.length; ++i) {
							const tileAnim = room.tileAnimations[i];

							let localTick = tick % tileAnim.totalLength;
							let frame = 0;
							for (let j = 0; j < tileAnim.keyframeLengths.length; ++j) {
								if (localTick < tileAnim.keyframeLengths[j]) {
									frame = tileAnim.keyframeIndices[j];
									break;
								}
								localTick -= tileAnim.keyframeLengths[j];
							}

							for (
								let j = 0,
									o = (tileAnim.tilesetAnimatedStart + frame * tileAnim.replacementLength) * 32;
								j < tileAnim.replacementLength;
								++j, o += 32
							) {
								layout[tileAnim.tilesetStart + j] = room.tilesetAnimated.slice(o, o + 32);
							}
						}
					}

					const tilesetBitmap = new Uint32Array(256 * 256);
					for (let i = 0; i * 32 < room.tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						// 16-color
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = layout[i][j] ?? 0;
							tilesetBitmap[pos] = palette[composite & 0xf];
							tilesetBitmap[pos ^ 1] = palette[composite >> 4];
						}
					}
					tilesetCtx.putImageData(new ImageData(bufToU8Clamped(tilesetBitmap), 256, 256), 0, 0);
				} else {
					tilesetCtx.clearRect(0, 0, 256, 256);
				}

				// tilesetAnimated
				const tilesetAnimatedCtx = tilesetAnimatedCanvas.getContext('2d');
				if (room.tilesetAnimated) {
					const bitmap = new Uint32Array(256 * 256);
					for (let i = 0; i * 32 < room.tilesetAnimated.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						// 16-color
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = room.tilesetAnimated[i * 32 + j] ?? 0;
							bitmap[pos] = palette[composite & 0xf];
							bitmap[pos ^ 1] = palette[composite >> 4];
						}
					}
					tilesetAnimatedCtx.putImageData(new ImageData(bufToU8Clamped(bitmap), 256, 256), 0, 0);
				} else {
					tilesetAnimatedCtx.clearRect(0, 0, 256, 256);
				}

				// map
				const mapCtx = mapCanvas.getContext('2d');
				if (updateMap) {
					const height = options.margins.checked ? 256 : 192;
					mapCanvas.height = height;
					if (room.tileset) {
						const mapBitmap = new Uint32Array(512 * 256);
						mapBitmap.fill(palette[0], 0, 512 * 256);
						for (let i = 2; i >= 0; --i) {
							const layerIndex = options.reverseLayers.checked ? 2 - i : i;
							const tilemap = room.tilemaps[layerIndex];
							if (!options.bgChecks[layerIndex].checked || !tilemap) continue;

							for (let j = 0; j < tilemap.length; ++j) {
								const tile = tilemap[j];
								const paletteRow = (tile >> 12) << 4;

								const basePos = ((j >> 6) << 12) | ((j & 0x3f) << 3); // y = i >> 6, x = i & 0x3f
								for (let k = 0; k < 32; ++k) {
									let pos = basePos | ((k >> 2) << 9) | ((k & 0x3) << 1);
									if (tile & 0x400) pos ^= 0x7; // horizontal flip
									if (tile & 0x800) pos ^= 0x7 << 9; // vertical flip

									const composite = layout[tile & 0x3ff][k] ?? 0;
									if (composite & 0xf) mapBitmap[pos] = palette[paletteRow | (composite & 0xf)];
									if (composite >> 4) mapBitmap[pos ^ 1] = palette[paletteRow | (composite >> 4)];
								}
							}
						}
						mapCtx.putImageData(
							new ImageData(bufToU8Clamped(mapBitmap), 512, 256),
							0,
							options.margins.checked ? 0 : -32,
						);
					} else {
						mapCtx.clearRect(0, 0, 512, height);
					}
				}
			}

			updatePalette = updateTileset = updateTilesetAnimated = updateMap = false;

			requestAnimationFrame(render);
		};
		update();
		render();

		battle.png = (roomId, bg1, bg2, bg3, reverseLayers, margins) => {
			// this is almost identical to field.png
			const rawRoom = battle.bmaps[roomId];
			const tileset = bufToU8(lzBis(rawRoom.tileset));
			const palette = rgb15To32(bufToU16(rawRoom.palette));
			const tilemaps = rawRoom.tilemaps.map((x) => (x?.byteLength ? bufToU16(x) : undefined));

			const inset = margins ? 0 : 4;

			const bitmap = new Uint32Array(512 * (margins ? 256 : 192));
			bitmap.fill(palette[0], 0, bitmap.length);
			const layers = reverseLayers ? [0, 1, 2] : [2, 1, 0];
			for (const i of layers) {
				const tilemap = tilemaps[i];
				if (![bg1, bg2, bg3][i] || !tilemap) continue;

				for (let y = inset; y < 32 - inset; ++y) {
					for (let x = 0; x < 64; ++x) {
						const basePos = ((y - inset) << 12) | (x << 3);
						const tile = tilemap[y * 64 + x];
						// 16-color
						const paletteShift = (tile >> 12) << 4;
						for (let j = 0, o = (tile & 0x3ff) * 32; j < 64; j += 2, ++o) {
							let pos = basePos | ((j >> 3) << 9) | (j & 7);
							if (tile & 0x400) pos ^= 7; // horizontal flip
							if (tile & 0x800) pos ^= 7 << 9; // vertical flip
							const composite = tileset[o] ?? 0;
							if (composite & 0xf) bitmap[pos] = palette[paletteShift | (composite & 0xf)];
							if (composite >> 4) bitmap[pos ^ 1] = palette[paletteShift | (composite >> 4)];
						}
					}
				}
			}

			return png(bitmap, 512, margins ? 256 : 192);
		};

		return battle;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Giant Battle Maps                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	const battleGiant = (window.battleGiant = createSection('Giant Battle Maps', (section) => {
		const battleGiant = {};

		if (!fs.has('/BMapG/BMapG.dat')) {
			addHTML(
				section,
				`<div>This version (${headers.gamecode}) doesn't have /BMapG/BMapG.dat (the giant battle map file)</div>`,
			);
			return;
		}

		const selectOptions = [];
		for (let i = 0; i < fsext.bmapg.segments.length; ++i) selectOptions.push(`BMapG 0x${i.toString(16)}`);
		const bmapgSelect = dropdown(selectOptions, 0, () => render());
		section.appendChild(bmapgSelect);

		const bgChecks = [];
		section.appendChild((bgChecks[0] = checkbox('BG1', true, () => render())));
		section.appendChild((bgChecks[1] = checkbox('BG2', true, () => render())));

		const mapCanvas = document.createElement('canvas');
		mapCanvas.style.cssText = 'width: 2048px; height: 512px;';
		mapCanvas.width = 2048;
		mapCanvas.height = 512;
		section.appendChild(mapCanvas);

		const componentPreview = document.createElement('div');
		componentPreview.style.cssText = 'height: 256px; position: relative;';
		section.appendChild(componentPreview);

		const tilesetCanvas = document.createElement('canvas');
		tilesetCanvas.style.cssText = 'position: absolute; top: 0px; left: 0px; width: 256px; height: 256px;';
		tilesetCanvas.width = tilesetCanvas.height = 256;
		componentPreview.appendChild(tilesetCanvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.style.cssText = 'position: absolute; top: 0px; left: 256px; width: 128px; height: 128px;';
		paletteCanvas.width = paletteCanvas.height = 16;
		componentPreview.appendChild(paletteCanvas);

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		const render = () => {
			const room = unpackSegmented(lzBis(fsext.bmapg.segments[bmapgSelect.value]));
			const palette = room[0]?.byteLength && rgb15To32(bufToU16(room[0]));
			const tileset = room[1]?.byteLength && bufToU8(room[1]);
			const tilemaps = [2, 3].map((index) => room[index]?.byteLength && bufToU16(room[index]));
			const unknown4 = room[4];
			const unknown5 = room[5];
			const unknown6 = room[6];

			// palette
			const paletteCtx = paletteCanvas.getContext('2d');
			if (palette) paletteCtx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
			else paletteCtx.clearRect(0, 0, 16, 16);

			// tileset
			const tilesetCtx = tilesetCanvas.getContext('2d');
			if (palette && tileset) {
				const tilesetBitmap = new Uint32Array(256 * 256);
				let o = 0;
				for (let i = 0; i * 64 < tileset.byteLength; ++i) {
					const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
					// 256-color
					for (let j = 0; j < 64; ++j) {
						const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
						tilesetBitmap[pos] = palette[tileset[i * 64 + j] ?? 0];
					}
				}
				tilesetCtx.putImageData(new ImageData(bufToU8Clamped(tilesetBitmap), 256, 256), 0, 0);
			} else {
				tilesetCtx.clearRect(0, 0, 256, 256);
			}

			// map
			const mapCtx = mapCanvas.getContext('2d');
			if (palette && tileset) {
				const mapBitmap = new Uint32Array(2048 * 512);
				// maybe there are more layers, so use an array
				for (let i = 1; i >= 0; --i) {
					const tilemap = tilemaps[i];
					if (!bgChecks[i].checked) continue;

					for (let j = 0; j < tilemap.length; ++j) {
						const tile = tilemap[j];

						// 256-color
						const basePos = ((j >> 7) << 14) | ((j & 0x7f) << 3); // y = i >> 7, x = i & 0x7f
						const tileOffset = (tile & 0x3ff) * 64;
						for (let k = 0; k < 64; ++k) {
							let pos = basePos | ((k >> 3) << 11) | (k & 0x7);
							if (tile & 0x400) pos ^= 0x7; // horizontal flip
							if (tile & 0x800) pos ^= 0x7 << 11; // vertical flip

							const paletteIndex = tileset[tileOffset + k] ?? 0;
							if (!paletteIndex) continue;
							mapBitmap[pos] = palette[paletteIndex];
						}
					}
				}

				mapCtx.putImageData(new ImageData(bufToU8Clamped(mapBitmap), 2048, 512), 0, 0);
			} else {
				mapCtx.clearRect(0, 0, 2048, 512);
			}

			// metadata below
			metaPreview.innerHTML = '';

			const metaLines = [];
			metaLines.push(`Tilemap sizes: ${tilemaps[0]?.byteLength}, ${tilemaps[1]?.byteLength}`);
			metaLines.push(`unknown4 size: ${unknown4?.byteLength}`);
			metaLines.push(`unknown4 preview: <code>${bytes(0, 256, unknown4)}</code>`);
			metaLines.push(`unknown5 size: ${unknown5?.byteLength}`);
			metaLines.push(`unknown5 preview: <code>${bytes(0, 256, unknown5)}</code>`);
			metaLines.push(`unknown6 size: ${unknown6?.byteLength}`);
			metaLines.push(`unknown6 preview: <code>${bytes(0, 256, unknown6)}</code>`);
			for (const metaLine of metaLines) addHTML(metaPreview, '<div>' + metaLine + '</div>');
		};
		render();

		return battleGiant;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Menu Maps                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const menu = (window.menu = createSection('Menu Maps', (section) => {
		const menu = {};

		const menuFile = fs.get('/MMap/MMap.dat');
		const maps = (menu.maps = unpackSegmented(menuFile));

		const tilesetOptions = [];
		const tilemapOptions = [];
		const paletteOptions = [];
		for (let i = 0; i < maps.length; ++i) {
			if (maps[i].byteLength === 512) {
				paletteOptions.push([`MMap Palette 0x${i.toString(16)}`, i]);
			} else {
				tilesetOptions.push([`MMap Tileset 0x${i.toString(16)}`, i]);
				tilemapOptions.push([`MMap Tilemap 0x${i.toString(16)}`, i]);
			}
		}

		const tilesetSelect = dropdown(
			tilesetOptions.map((x) => x[0]),
			0,
			() => render(),
		);
		section.appendChild(tilesetSelect);
		const tilemapSelect = dropdown(
			tilemapOptions.map((x) => x[0]),
			0,
			() => render(),
		);
		section.appendChild(tilemapSelect);
		const paletteSelect = dropdown(
			paletteOptions.map((x) => x[0]),
			0,
			() => render(),
		);
		section.appendChild(paletteSelect);

		const mapContainer = document.createElement('div');
		mapContainer.style.cssText = 'position: relative; height: 192px;';
		section.appendChild(mapContainer);

		const mapCanvas16 = document.createElement('canvas');
		mapCanvas16.width = 256;
		mapCanvas16.height = 192;
		mapCanvas16.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(mapCanvas16);

		const mapCanvas256 = document.createElement('canvas');
		mapCanvas256.width = 256;
		mapCanvas256.height = 192;
		mapCanvas256.style.cssText = 'position: absolute; top: 0; left: 256px;';
		mapContainer.appendChild(mapCanvas256);

		const componentContainer = document.createElement('div');
		componentContainer.style.cssText = 'position: relative; height: 256px;';
		section.appendChild(componentContainer);

		const tilesetCanvas16 = document.createElement('canvas');
		tilesetCanvas16.width = tilesetCanvas16.height = 256;
		tilesetCanvas16.style.cssText = 'position: absolute; top: 0; left: 0;';
		componentContainer.appendChild(tilesetCanvas16);

		const tilesetCanvas256 = document.createElement('canvas');
		tilesetCanvas256.width = tilesetCanvas256.height = 256;
		tilesetCanvas256.style.cssText = 'position: absolute; top: 0; left: 256px;';
		componentContainer.appendChild(tilesetCanvas256);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.width = paletteCanvas.height = 16;
		paletteCanvas.style.cssText = 'position: absolute; top: 0; left: 512px; width: 128px; height: 128px;';
		componentContainer.appendChild(paletteCanvas);

		const render = () => {
			// palette
			const paletteDat = maps[paletteOptions[paletteSelect.value][1]];
			let palette;
			if (paletteDat.byteLength === 512) {
				palette = rgb15To32(bufToU16(paletteDat));
			}

			{
				const ctx = paletteCanvas.getContext('2d');
				if (palette) {
					ctx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
				} else {
					ctx.clearRect(0, 0, 16, 16);
				}
			}

			// tileset
			const tilesetDat = maps[tilesetOptions[tilesetSelect.value][1]];
			let tileset;
			try {
				tileset = bufToU8(lzBis(tilesetDat));
			} catch (_) {}
			{
				const ctx16 = tilesetCanvas16.getContext('2d');
				const ctx256 = tilesetCanvas256.getContext('2d');
				if (tileset && palette) {
					const bitmap16 = new Uint32Array(256 * 256);
					const bitmap256 = new Uint32Array(256 * 256);
					// 16-color
					for (let i = 0; i * 32 < tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = tileset[i * 32 + j];
							bitmap16[pos] = palette[composite & 0xf];
							bitmap16[pos ^ 1] = palette[composite >> 4];
						}
					}

					ctx16.putImageData(new ImageData(bufToU8Clamped(bitmap16), 256, 256), 0, 0);

					// 256-color
					for (let i = 0; i * 64 < tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						for (let j = 0; j < 64; ++j) {
							const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
							bitmap256[pos] = palette[tileset[i * 64 + j]];
						}
					}

					ctx256.putImageData(new ImageData(bufToU8Clamped(bitmap256), 256, 256), 0, 0);
				} else {
					ctx16.clearRect(0, 0, 256, 256);
					ctx256.clearRect(0, 0, 256, 256);
				}
			}

			// tilemap
			const tilemapDat = maps[tilemapOptions[tilemapSelect.value][1]];
			let tilemap;
			try {
				tilemap = bufToU16(lzBis(tilemapDat));
			} catch (_) {}

			{
				const ctx16 = mapCanvas16.getContext('2d');
				const ctx256 = mapCanvas256.getContext('2d');

				if (tilemap && tileset && palette) {
					// 16-color
					const bitmap16 = new Uint32Array(256 * 192);
					for (let i = 0; i < tilemap.length; ++i) {
						const basePos = ((i >> 6) << 12) | ((i & 0x3f) << 3);
						const tile = tilemap[i];
						const tileOffset = (tile & 0x3ff) * 32;
						const paletteRow = (tile >> 12) << 4;
						for (let j = 0; j < 32; ++j) {
							let pos = basePos | ((j >> 2) << 9) | ((j & 0x3) << 1);
							if (tile & 0x400) pos ^= 0x7;
							if (tile & 0x800) pos ^= 0x7 << 8;

							const composite = tileset[tileOffset + j];
							if (composite & 0xf) bitmap16[pos] = palette[paletteRow | (composite & 0xf)];
							if (composite >> 4) bitmap16[pos ^ 1] = palette[paletteRow | (composite >> 4)];
						}
					}

					ctx16.putImageData(new ImageData(bufToU8Clamped(bitmap16), 256, 192), 0, 0);

					// 256-color
					const bitmap256 = new Uint32Array(256 * 192);
					for (let i = 0; i < tilemap.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3);
						const tile = tilemap[i];
						const tileOffset = (tile & 0x3ff) * 64;
						for (let j = 0; j < 64; ++j) {
							let pos = basePos | ((j >> 3) << 8) | (j & 0x7);
							if (tile & 0x400) pos ^= 0x7;
							if (tile & 0x800) pos ^= 0x7 << 8;

							const paletteIndex = tileset[tileOffset + j];
							if (paletteIndex) bitmap256[pos] = palette[paletteIndex];
						}
					}

					ctx256.putImageData(new ImageData(bufToU8Clamped(bitmap256), 256, 192), 0, 0);
				} else {
					ctx16.clearRect(0, 0, 256, 192);
					ctx256.clearRect(0, 0, 256, 192);
				}
			}
		};
		render();

		return menu;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Fonts                                                                                                |
	// +---------------------------------------------------------------------------------------------------------------+

	const fonts = (window.fonts = createSection('Fonts', (section) => {
		const fonts = {};

		fonts.glyphs1Bit = (dat, dataWidth, dataHeight, glyphWidth, glyphHeight) => {
			const u8 = bufToU8(dat);
			const glyphs = [];

			const glyphY = glyphHeight - dataHeight - 3;

			const byteSkip = Math.ceil(dataWidth * dataHeight / 8);
			for (let o = 0; o < u8.length; o += byteSkip) {
				const bitmap = new Uint8Array(glyphWidth * glyphHeight);
				for (let y = 0, bitOffset = 0; y < dataHeight; ++y) {
					for (let x = 0; x < dataWidth; ++x, ++bitOffset) {
						const bit = u8[o + (bitOffset >> 3)] & (0x80 >> (bitOffset & 7));
						if (bit) {
							bitmap[(y + glyphY) * glyphWidth + x] = 2;
							bitmap[(y + glyphY - 1) * glyphWidth + x] ||= 1; // up shadow
							if (x > 0) bitmap[(y + glyphY + 1) * glyphWidth + (x - 1)] ||= 1; // left shadow
							bitmap[(y + glyphY + 1) * glyphWidth + x] ||= 1; // down shadow
							bitmap[(y + glyphY) * glyphWidth + (x + 1)] ||= 1; // right shadow
						}
					}
				}
				glyphs.push(bitmap);
			}

			return glyphs;
		};

		fonts.glyphs2Bit = (dat, width, height) => {
			const u8 = bufToU8(dat);
			const glyphs = [];

			for (let o = 0; o < u8.length;) {
				const bitmap = new Uint8Array(width * height);
				const startO = o;
				for (let baseX = 0; baseX < width; baseX += 8) {
					const columnWidth = Math.min(8, width - baseX);
					for (let baseY = 0; baseY < height; baseY += 4) {
						const alphaO = o;
						const shadeO = o + (columnWidth >> 1);
						o += columnWidth;
						for (let x = 0, bitOffset = 0; x < columnWidth; ++x) {
							for (let y = 0; y < 4; ++y, ++bitOffset) {
								const alpha = u8[alphaO + (bitOffset >> 3)] & (1 << (bitOffset & 7));
								const shade = u8[shadeO + (bitOffset >> 3)] & (1 << (bitOffset & 7));
								bitmap[(baseY + y) * width + baseX + x] = alpha ? shade ? 1 : 2 : 0;
							}
						}
					}
				}
				bitmap.SLICE = sliceDataView(dat, startO, o);
				glyphs.push(bitmap);
			}

			return glyphs;
		};

		fonts.standard = (dat) => {
			const chars = new Map();
			const charMapSize = dat.getUint32(0, true);
			const segments = unpackSegmentedUnsorted(dat, 4);
			const charMap = segments.shift();

			const byGlyph = new Map();
			for (let i = 0; i < segments.length; ++i) {
				const glyphTable = segments[i];
				const glyphWidth = (glyphTable.getUint8(0) >> 4) * 4;
				const glyphHeight = (glyphTable.getUint8(0) & 0xf) * 4;
				const numGlyphs = glyphTable.getUint8(3) * 8;

				const actualWidths = [];
				let o = 4;
				if (glyphWidth <= 16) {
					for (let j = 0; j < numGlyphs; j += 2) {
						const composite = glyphTable.getUint8(o++);
						actualWidths.push(composite & 0xf, composite >> 4);
					}
				} else {
					for (let j = 0; j < numGlyphs; ++j) {
						actualWidths.push(glyphTable.getUint8(o++));
					}
				}

				const glyphs = fonts.glyphs2Bit(sliceDataView(glyphTable, o, glyphTable.byteLength), glyphWidth, glyphHeight);
				for (let j = 0; j < glyphs.length; ++j) {
					byGlyph.set(i << 8 | j, {
						actualWidth: actualWidths[j] + 1,
						bitmap: glyphs[j],
						height: glyphHeight,
						width: glyphWidth,
					});
				}
			}

			const byCode = new Map();
			for (let i = 0, o = 0; o < charMapSize; ++i, o += 2) {
				const glyphId = charMap.getInt16(o, false); // big endian!!
				if (glyphId === -1) continue;
				byCode.set(i, byGlyph.get(glyphId));
			}

			return { byCode, byGlyph };
		};

		fonts.fixed = (dat, dataWidth, dataHeight, glyphWidth, glyphHeight, is2Bit) => {
			const byGlyph = new Map();
			const glyphs = is2Bit
				? fonts.glyphs2Bit(dat, dataWidth, dataHeight)
				: fonts.glyphs1Bit(dat, dataWidth, dataHeight, glyphWidth, glyphHeight);
			for (let i = 0; i < glyphs.length; ++i) {
				byGlyph.set(i, { actualWidth: glyphWidth, bitmap: glyphs[i], height: glyphHeight, width: glyphWidth });
			}

			return { byCode: byGlyph, byGlyph };
		};

		fonts.preview = (table, glyphsPerRow, showActualWidth) => {
			let maxGlyphWidth = 0;
			let maxGlyphHeight = 0;
			let maxKey = 0;
			for (const [key, char] of table) {
				if (key > maxKey) maxKey = key;
				if (char.width > maxGlyphWidth) maxGlyphWidth = char.width;
				if (char.height > maxGlyphHeight) maxGlyphHeight = char.height;
			}

			const paddedGlyphWidth = maxGlyphWidth + 2;
			const paddedGlyphHeight = maxGlyphHeight + 2;

			const bitmapWidth = paddedGlyphWidth * glyphsPerRow || 1;
			const bitmapHeight = paddedGlyphHeight * Math.ceil((maxKey + 1) / glyphsPerRow) || 1;
			const bitmap = new Uint32Array(bitmapWidth * bitmapHeight);
			for (let i = 0; i <= maxKey; ++i) {
				const cellX = i % glyphsPerRow;
				const baseX = cellX * paddedGlyphWidth;
				const cellY = Math.floor(i / glyphsPerRow);
				const baseY = cellY * paddedGlyphHeight;
				const oddTile = (cellX & 1) ^ (cellY & 1);

				const glyph = table.get(i);
				if (!glyph) continue;

				for (let y = 0; y < paddedGlyphHeight; ++y) {
					bitmap.fill(
						oddTile ? 0xffd6f7ff : 0xffa5cee6,
						(baseY + y) * bitmapWidth + baseX,
						(baseY + y) * bitmapWidth + baseX + paddedGlyphWidth,
					);
				}

				const { actualWidth, width, height, bitmap: glyphBitmap } = glyph;

				for (let y = 0; y < height; ++y) {
					for (let x = 0; x < width; ++x) {
						const color = glyphBitmap[y * width + x];
						// +1 on each component for padding
						if (color) bitmap[(baseY + y + 1) * bitmapWidth + baseX + x + 1] = color === 1 ? 0xffdee6ef : 0xff314263;
					}
				}

				if (showActualWidth) {
					for (let x = 0; x < actualWidth; ++x) {
						bitmap[(baseY + paddedGlyphHeight - 1) * bitmapWidth + baseX + x + 1] = 0xff0099ff;
					}
				}
			}

			return { bitmap, bitmapWidth, bitmapHeight };
		};

		const errorGlyph = {
			bitmap: new Uint32Array([
				3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3, // padding
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3, // padding
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3, // padding
				3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3, // padding
				3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,
			]),
			width: 16,
			height: 11,
			actualWidth: 16,
		};
		const variableGlyph = {
			bitmap: new Uint32Array([
				4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4, //
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4, // padding
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4, // padding
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
				4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4, // padding
				4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
			]),
			width: 16,
			height: 16,
			actualWidth: 16,
		};
		const customGlyphChars = [
			[0,1,0, 1,0,1, 1,0,1, 1,0,1, 0,1,0], // 0
			[0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1], // 1
			[0,1,0, 1,0,1, 0,0,1, 0,1,0, 1,1,1], // 2
			[1,1,0, 0,0,1, 1,1,0, 0,0,1, 1,1,0], // 3
			[1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1], // 4
			[1,1,1, 1,0,0, 1,1,0, 0,0,1, 1,1,0], // 5
			[0,1,1, 1,0,0, 1,1,1, 1,0,1, 0,1,0], // 6
			[1,1,1, 0,0,1, 0,0,1, 0,1,0, 0,1,0], // 7
			[0,1,0, 1,0,1, 0,1,0, 1,0,1, 0,1,0], // 8
			[0,1,0, 1,0,1, 0,1,1, 0,0,1, 1,1,0], // 9
			[0,1,0, 1,0,1, 1,1,1, 1,0,1, 1,0,1], // A
			[1,1,0, 1,0,1, 1,1,0, 1,0,1, 1,1,0], // B
			[0,1,1, 1,0,0, 1,0,0, 1,0,0, 0,1,1], // C
			[1,1,0, 1,0,1, 1,0,1, 1,0,1, 1,1,0], // D
			[1,1,1, 1,0,0, 1,1,1, 1,0,0, 1,1,1], // E
			[1,1,1, 1,0,0, 1,1,1, 1,0,0, 1,0,0], // F
			[0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0], // (empty)
		];
		const drawCustomChar = (destGlyphBitmap, i, baseX, baseY, color) => {
			const charBitmap = customGlyphChars[i];
			for (let y = 0; y < 5; ++y) {
				for (let x = 0; x < 3; ++x) {
					destGlyphBitmap[(baseY + y) * 16 + baseX + x] = charBitmap[y * 3 + x] ? color : 0;
				}
			}
		};

		fonts.textbox = (message, font, altFonts, width, height, bitmap, rocFonts, defaultRocFont, textSpacing) => {
			let bitmapWidth = 256 + 8;
			while (bitmapWidth < width) bitmapWidth *= 2;
			bitmap ??= new Uint32Array(bitmapWidth * 192); // just for working
			bitmap.fill(0xffd6f7ff, 0, bitmap.length);
			let contentWidth = width || 1;
			let baseX = 0;
			let baseY = 0;
			let lineHeight = 16; // ???

			const resize = () => {
				if (bitmapWidth * (baseY + lineHeight + 8) <= bitmap.length) return;

				const newBitmap = new Uint32Array(bitmap.length * 2);
				newBitmap.set(bitmap, 0);
				newBitmap.fill(0xffd6f7ff, bitmap.length, newBitmap.length);
				bitmap = newBitmap;
			};
			resize();

			let currentFont = font;
			let currentReplacementFont = altFonts[0];
			let rocFont = defaultRocFont;
			let darkColor = 0xff314263;
			let shadowColor = 0xffdee6ef;
			let noLetterSpacing = false;
			let textWritten = false;

			const u8 = bufToU8(message);
			for (let o = 0; o < u8.length;) {
				let glyph;
				const char = u8[o++];
				if (char === 0xff) {
					// formatting
					const control = u8[o++];
					if (control === 0x00) {
						// line break
						baseX = 0;
						baseY += lineHeight + 4;
						lineHeight = 16;
						resize();
					} else if (control === 0x01) {
						// reset text
						++o; // ?
						if (textWritten) {
							baseX = 0;
							baseY += lineHeight + 4;
							lineHeight = 16;
							resize();
							for (let x = 0; x < bitmapWidth; ++x) {
								bitmap[baseY * bitmapWidth + x] = 0xff0099ff;
							}
							++baseY;
							resize();
							textWritten = false;
						}
					} else if (control === 0x0a) ++o; // close textbox
					else if (control === 0x0b) {
						// new textbox page (may scroll down) TODO doesn't BIS have scrolling textboxes???
						++o; // ?
						if (textWritten) {
							baseX = 0;
							baseY += lineHeight + 4;
							lineHeight = 16;
							resize();
							for (let x = 0; x < bitmapWidth; ++x) {
								const y = [0, 1, 2, 1][x & 3];
								bitmap[(baseY + y) * bitmapWidth + x] = 0xff0099ff;
							}
							baseY += 3;
							resize();
							textWritten = false;
						}
					} else if (control === 0x0c) ++o; // wait TODO display some placeholder here
					else if (control === 0x0f) {
						// variable display, generate a glyph
						const fine = u8[o++];
						const broad = u8[o++];
						drawCustomChar(variableGlyph.bitmap, fine >> 4, 4, 2, 4);
						drawCustomChar(variableGlyph.bitmap, fine & 0xf, 9, 2, 4);
						drawCustomChar(variableGlyph.bitmap, broad >> 4, 4, 9, 4);
						drawCustomChar(variableGlyph.bitmap, broad & 0xf, 9, 9, 4);
						glyph = variableGlyph;
					} else if (control === 0x11) ++o; // button prompt TODO show this
					else if (control === 0x20) [darkColor, shadowColor] = [0xff314263, 0xffdee6ef]; // default
					else if (control === 0x21) [darkColor, shadowColor] = [0xffdee6ef, 0xff3a4252]; // (239,230,222) (82,66,58)
					else if (control === 0x22) [darkColor, shadowColor] = [0xff3a4252, 0xff6ba5c5]; // (82,66,58) (197,165,107)
					else if (control === 0x23) [darkColor, shadowColor] = [0xff6ba5c5, 0xffa5cee6]; // (197,165,107) (230,206,165)
					else if (control === 0x24) [darkColor, shadowColor] = [0xffa5cee6, 0xffd6f7ff]; // (230,206,165) (255,247,214)
					else if (control === 0x25) [darkColor, shadowColor] = [0xffd6f7ff, 0xffffffff]; // (255,247,214) (255,255,255)
					else if (control === 0x26) [darkColor, shadowColor] = [0xffffffff, 0xff00c500]; // (255,255,255) (0,197,0)
					else if (control === 0x27) [darkColor, shadowColor] = [0xff00c500, 0xffdeffe6]; // (0,197,0) (230,255,222)
					else if (control === 0x28) [darkColor, shadowColor] = [0xffdeff17, 0xff007bff]; // (230,255,222) (255,123,0)
					else if (control === 0x29) [darkColor, shadowColor] = [0xff007bff, 0xffc5e6ff]; // (255,123,0) (255,230,197)
					else if (control === 0x2a) [darkColor, shadowColor] = [0xffc5e6ff, 0xffff5a31]; // (255,230,197) (49,90,255)
					else if (control === 0x2b) [darkColor, shadowColor] = [0xffff5a31, 0xfff7f7e6]; // (49,90,255) (230,247,247)
					else if (control === 0x2c) [darkColor, shadowColor] = [0xfff7f7e6, 0xff0000ff]; // (230,247,247) (255,0,0)
					else if (control === 0x2d) [darkColor, shadowColor] = [0xff0000ff, 0xffd6d6ff]; // (255,0,0) (255,214,214)
					else if (control === 0x2e) [darkColor, shadowColor] = [0xff0000ff, 0xffd6d6ff]; // (255,0,0) (255,214,214)
					else if (control === 0x2f) [darkColor, shadowColor] = [0x00000000, 0xff314263]; // transparent (99,66,49)
					else if (control === 0x40) {
						// normal font
						[currentFont, currentReplacementFont, rocFont] = [font, altFonts[0], defaultRocFont];
					} else if (control === 0x41) {
						// small font
						[currentFont, currentReplacementFont, rocFont] = [altFonts[1], altFonts[2], rocFonts?.[1]];
					} else if (control === 0x42) {
						// big font
						[currentFont, currentReplacementFont, rocFont] = [altFonts[3], altFonts[4], rocFonts?.[2]];
					} else if (0x60 <= control && control <= 0xe0) {
						// TEST DEBUG
						drawCustomChar(variableGlyph.bitmap, control >> 4, 4, 2, 4);
						drawCustomChar(variableGlyph.bitmap, control & 0xf, 9, 2, 4);
						drawCustomChar(variableGlyph.bitmap, 16, 4, 9, 4);
						drawCustomChar(variableGlyph.bitmap, 16, 9, 9, 4);
						glyph = variableGlyph;
					} else if (control === 0xe8) noLetterSpacing = true;
					else if (control === 0xef) noLetterSpacing = false;
					
					if (!glyph) continue; // some control characters are drawn
				}

				if (char === 0x00) continue; // ?
				if (char === 0x20) {
					baseX += 8;
					continue;
				}

				textWritten = true;

				let code = char;
				if (!glyph) {
					if (char >= 0xf9 && currentReplacementFont) {
						// take from replacement characters
						code = u8[o++];
						if (char === 0xfe) code |= 0;
						else if (char === 0xfd) code |= 0x100;
						else if (char === 0xfc) code |= 0x200;
						else if (char === 0xfb) code |= 0x300;
						else if (char === 0xfa) code |= 0x400;
						else if (char === 0xf9) code |= 0x500;
						glyph = currentReplacementFont.byCode.get(code);
					} else if (char <= 0x08 && rocFont) {
						// ROC square font access
						code = u8[o++];
						if (char === 0x01) code -= 1;
						else if (char === 0x02) code += 0xf8;
						else if (char === 0x03) code += 0x1f1;
						else if (char === 0x04) code += 0x2ea;
						else if (char === 0x05) code += 0x3e3;
						else if (char === 0x06) code += 0x4dc;
						else if (char === 0x07) code += 0x5d5;
						else if (char === 0x08) code += 0x6ce;
						glyph = rocFont.byCode.get(code);
					} else {
						glyph = currentFont?.byCode.get(code);
					}
				}

				if (!glyph) {
					// invalid glyph; generate a symbol
					drawCustomChar(errorGlyph.bitmap, (code >> 8) & 0xf, 2, 3, 3);
					drawCustomChar(errorGlyph.bitmap, (code >> 4) & 0xf, 6, 3, 3);
					drawCustomChar(errorGlyph.bitmap, code & 0xf, 10, 3, 3);
					glyph = errorGlyph;
				}

				if (baseX + glyph.actualWidth > contentWidth) {
					// resize
					contentWidth = Math.min(baseX + glyph.width, width || 256);
					// if exceeding a fixed width, newline first (don't change contentWidth though)
					if (baseX + glyph.width > contentWidth) {
						baseX = 0;
						baseY += lineHeight + 4;
						lineHeight = 16;
						resize();
					}
				}

				if (glyph.height > lineHeight) {
					lineHeight = glyph.height;
					resize();
				}

				for (let y = 0; y < glyph.height; ++y) {
					for (let x = 0; x < glyph.width; ++x) {
						const pos = (baseY + 4 + y) * bitmapWidth + (baseX + 4 + x);
						const pixel = glyph.bitmap[y * glyph.width + x];
						if (pixel === 1) bitmap[pos] = shadowColor;
						else if (pixel === 2) bitmap[pos] = darkColor;
						else if (pixel === 3) bitmap[pos] = 0xff0000ff; // debug red
						else if (pixel === 4) bitmap[pos] = 0xffff9900; // debug blue
					}
				}
				baseX += glyph.actualWidth + (noLetterSpacing ? 0 : textSpacing);
			}

			const bitmapHeight = baseY + lineHeight + 4;
			return { bitmap, bitmapWidth, bitmapHeight, actualWidth: contentWidth + 8 };
		};

		const optionFonts = fonts.optionFonts = [];
		const optionNames = fonts.optionNames = [];
		if (fsext.font) { // not available in JP/ROC
			optionFonts.push(fonts.standard(fsext.font));
			optionNames.push('ARM9 Font');
		}

		const statSegments = unpackSegmented(fs.get('/Font/StatFontSet.dat'));
		for (let i = 0; i < statSegments.length; ++i) {
			const u8 = bufToU8(statSegments[i]);
			for (let o = 0; o < u8.length; ++o) {
				if (u8[o]) {
					// only add segments that aren't zero'd out
					optionNames.push(`StatFontSet [${i}]`);
					optionFonts.push(fonts.standard(statSegments[i]));
					break;
				}
			}
		}

		if (fs.has('/Font/11x11.bin')) { // ROC only
			optionNames.push('11x11', '12x12', '20x20');
			optionFonts.push(
				fonts.fixed(fs.get('/Font/11x11.bin'), 11, 11, 12, 16, false),
				fonts.fixed(fs.get('/Font/12x12.bin'), 12, 12, 12, 12, true),
				fonts.fixed(fs.get('/Font/20x20.bin'), 20, 20, 20, 20, true),
			);
		}

		const select = dropdown(optionNames, 0, () => update());
		section.appendChild(select);

		const showGlyphWidth = checkbox('Show Glyph Width', true, () => update());
		section.appendChild(showGlyphWidth);

		const alignCharCode = checkbox('Align To Character Codes', false, () => update());
		section.appendChild(alignCharCode);

		const list = document.createElement('div');
		list.style.cssText = 'display: grid; grid-columns: 512px 200px';
		section.appendChild(list);

		const update = () => {
			const font = optionFonts[select.value];
			const { bitmap, bitmapWidth, bitmapHeight } = fonts.preview(alignCharCode.checked ? font.byCode : font.byGlyph, 32, showGlyphWidth.checked);

			list.innerHTML = '';

			const canvas = document.createElement('canvas');
			canvas.width = bitmapWidth;
			canvas.height = bitmapHeight;
			canvas.style.cssText = `display: block; width: ${bitmapWidth * 2}px; height: ${bitmapHeight * 2}px;`;

			const ctx = canvas.getContext('2d');
			ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), bitmapWidth, bitmapHeight), 0, 0);

			list.appendChild(canvas);
		};
		update();

		return fonts;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Messages                                                                                             |
	// +---------------------------------------------------------------------------------------------------------------+

	const messages = (window.messages = createSection('Messages', (section) => {
		const messages = {};

		const columnNamesWithFonts = [
			, // 0
			'CJK replacements', // 1
			'CJK small', // 2
			'CJK small replacements', // 3
			'CJK big', // 4
			'CJK big replacements', // 5
			'English (?)', // 6
			'English small', // 7
			'English (?)', // 8
			'English big', // 9
			'English (?)', // 10
			'French (?)', // 11
			'French small', // 12
			'French (?)', // 13
			'French big', // 14
			'French (?)', // 15
			'German (?)', // 16
			'German small', // 17
			'German (?)', // 18
			'German big', // 19
			'German (?)', // 20
			'Italian (?)', // 21
			'Italian small', // 22
			'Italian (?)', // 23
			'Italian big', // 24
			'Italian (?)', // 25
			'Spanish (?)', // 26
			'Spanish small', // 27
			'Spanish (?)', // 28
			'Spanish big', // 29
			'Spanish (?)', // 30
			,,,,,,,,,, // 31-40
			,,,,,,,,,, // 41-50
			,,,,,,,,,, // 51-60
			,,,,,, // 61-66
			'CJK', // 67
			'English', // 68
			'French', // 69
			'German', // 70
			'Italian', // 71
			'Spanish', // 72
		];

		const columnNamesWithoutFonts = [
			, // 0
			'CJK', // 1
			'English', // 2
			'French', // 3
			'German', // 4
			'Italian', // 5
			'Spanish', // 6
		];

		const options = [
			['/FEvent/FEvent.dat', 'fevent'],
			['/BAI/BMes_cf.dat', 'tables+textboxes+fonts'],
			['/BAI/BMes_ji.dat', 'tables+textboxes+fonts'],
			['/BAI/BMes_yo.dat', 'tables+textboxes+fonts'],
			['/MAI/MMes_yo.dat', 'tables+textboxes+fonts'],
			['/SAI/SMes_yo.dat', 'tables+textboxes+fonts'],
			['/BData/mfset_AItmC.dat', 'plain'], // PIT only?
			['/BData/mfset_AItmE.dat', 'plain'],
			['/BData/mfset_AItmE2.dat', 'plain'],
			['/BData/mfset_AItmN.dat', 'plain'],
			['/BData/mfset_BadgeE.dat', 'plain'],
			['/BData/mfset_BadgeEffectE.dat', 'plain'],
			['/BData/mfset_BadgeN.dat', 'plain'],
			['/BData/mfset_BonusE.dat', 'plain'],
			['/BData/mfset_Help.dat', 'plain'],
			['/BData/mfset_MiniGame.dat', 'plain'],
			['/BData/mfset_MonN.dat', 'plain'],
			['/BData/mfset_RankUpE.dat', 'plain'],
			['/BData/mfset_UItmE.dat', 'plain'],
			['/BData/mfset_UItmE2.dat', 'plain'],
			['/BData/mfset_UItmN.dat', 'plain'],
			['/BData/mfset_WearE.dat', 'plain'],
			['/BData/mfset_WearN.dat', 'plain'],
			['/BDataMiniGame/mfset_MesDat_MiniGame.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesJig.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesOutline.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesPlace.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesSys.dat', 'textboxes+fonts'],
			['/MData/mfset_InitLoadMes.dat', 'textboxes'],
			['/MData/mfset_MenuMes.dat', 'plain'],
			['/MData/mfset_ParamExpMes.dat', 'textboxes'],
			['/MData/mfset_ShopMes.dat', 'textboxes'],
		];

		const optionsContainer = document.createElement('div');
		optionsContainer.style.cssText = 'position: sticky; top: 0; z-index: 5; background: var(--bg); margin-bottom: 1px;';
		section.appendChild(optionsContainer);

		const fileSelect = dropdown(options.map(([name]) => name), 0, () => updateFile());
		optionsContainer.appendChild(fileSelect);

		let tableSelect = dropdown([''], 0, () => updateTable());
		tableSelect.style.display = 'none';
		optionsContainer.appendChild(tableSelect);

		addHTML(optionsContainer, '<br>');

		const isRoc = fs.has('/Font/11x11.bin');
		let defaultFont = 1;
		if (headers.gamecode === 'CLJJ') defaultFont = isRoc ? 3 : 0;
		else if (headers.gamecode === 'CLJK') defaultFont = 2;

		const gameFont = dropdown([
			'Japanese',
			'Latin',
			'Korean',
			'Chinese',
			'Hex View',
			...fonts.optionNames.map(x => `Font: ${x}`),
		], defaultFont, () => updateTable());
		optionsContainer.appendChild(gameFont);

		const textSpacing = dropdown(['Spacing: 1 (Latin)', 'Spacing: 2 (CJK)'], headers.gamecode === 'CLJJ' || headers.gamecode === 'CLJK' ? 1 : 0, () => updateTable());
		optionsContainer.appendChild(textSpacing);

		const rocFont = dropdown(['No ROC Font', 'ROC 11x11', 'ROC 12x12', 'ROC 20x20'], isRoc ? 1 : 0, () => updateTable());
		if (isRoc) optionsContainer.appendChild(rocFont);

		const textboxScale = dropdown(['Scale: 1x', 'Scale: 1.5x', 'Scale: 2x'], 2, () => updateTable());
		optionsContainer.appendChild(textboxScale);

		const fontTable = document.createElement('table');
		fontTable.className = 'bordered';
		section.appendChild(fontTable);

		const textTableContainer = document.createElement('div');
		textTableContainer.style.cssText = 'overflow-x: auto;';
		section.appendChild(textTableContainer);

		const textTable = document.createElement('table');
		textTable.className = 'bordered';
		textTableContainer.appendChild(textTable);

		let updateTable;
		const updateFile = () => {
			const [path, type] = options[fileSelect.value];
			const container = fs.get(path);

			let showTableOptions = false;
			const tableOptions = [];
			const tables = [];
			if (type === 'fevent') {
				showTableOptions = true;
				for (let i = 0; i * 3 + 2 < fsext.fevent.segments.length; ++i) {
					if (fsext.fevent.segments[i * 3 + 2].byteLength) tableOptions.push(`Room 0x${i.toString(16)}`);
					else tableOptions.push(`<span style="opacity: 0.5;">Room 0x${i.toString(16)}</span>`);
					tables.push(fsext.fevent.segments[i * 3 + 2]);
				}
			} else if (type === 'tables+textboxes+fonts') {
				showTableOptions = true;
				const segments = unpackSegmented(container);
				for (let i = 0; i < segments.length; ++i) {
					// check if nonzero
					let nonzero = false;
					const u8 = bufToU8(segments[i]);
					for (let o = 0; o < u8.length; ++o) {
						if (u8[o]) {
							nonzero = true;
							break;
						}
					}
					if (!nonzero) continue;

					tableOptions.push(`Table 0x${i.toString(16)}`);
					tables.push(segments[i]);
				}
			} else if (type === 'plain' || type === 'textboxes' || type === 'textboxes+fonts') {
				tables.push(container); // treat the entire file as one table
			}

			tableSelect.replaceWith((tableSelect = dropdown(showTableOptions ? tableOptions : [''], 0, () => updateTable())));
			tableSelect.style.display = tableOptions.length ? 'inline-block' : 'none';

			updateTable = () => {
				fontTable.innerHTML = '';
				textTable.innerHTML = '';

				const isSimple = type === 'plain' || type === 'textboxes';

				const columns = messages.columns = unpackSegmented(tables[tableSelect.value]);
				const fontColumns = [];
				const textColumns = [];
				for (let i = 0; i < columns.length; ++i) {
					let isNonzero = false;
					const u8 = bufToU8(columns[i]);
					for (let o = 0; o < u8.length; ++o) {
						if (u8[o]) {
							isNonzero = true;
							break;
						}
					}
					if (!isNonzero) continue;

					if (isSimple) {
						// always text
						textColumns.push(i);
					} else {
						// 1-5 = CJK fonts, 6-10 = English fonts, ..., 25-30 = Spanish fonts
						if (i <= 30) fontColumns.push(i);
						else textColumns.push(i);
					}
				}

				const canvasScale = [1, 1.5, 2][textboxScale.value];
				const fontColumnsParsed = new Map();
				for (const columnId of fontColumns) {
					const tr = document.createElement('tr');
					tr.innerHTML = `<th style="text-wrap: nowrap;"><code>[${columnId}]</code>
						${columnNamesWithFonts[columnId]}</th>`;

					const td = document.createElement('td');
					tr.appendChild(td);

					const font = fonts.standard(columns[columnId]);
					fontColumnsParsed.set(columnId, font);
					const { bitmap, bitmapWidth, bitmapHeight } = fonts.preview(font.byGlyph, 32, false);

					const canvas = document.createElement('canvas');
					canvas.width = bitmapWidth;
					canvas.height = bitmapHeight;
					canvas.style.cssText = `width: ${bitmapWidth * canvasScale}px; height: ${bitmapHeight * canvasScale}px;`;
					td.appendChild(canvas);

					const ctx = canvas.getContext('2d');
					ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), bitmapWidth, bitmapHeight), 0, 0);
					
					fontTable.appendChild(tr);
				}

				let rocFonts, defaultRocFont;
				if (rocFont.value > 0) {
					rocFonts = [
						fonts.fixed(fs.get('/Font/11x11.bin'), 11, 11, 12, 16, false),
						fonts.fixed(fs.get('/Font/12x12.bin'), 12, 12, 12, 12, true),
						fonts.fixed(fs.get('/Font/20x20.bin'), 20, 20, 20, 20, true),
					];
					defaultRocFont = rocFonts[rocFont.value - 1];
				}

				const headerTr = document.createElement('tr');
				headerTr.innerHTML = '<th></th>';
				for (const columnId of textColumns) {
					addHTML(headerTr, `<th><code>[${columnId}]</code> ${isSimple ? columnNamesWithoutFonts[columnId] : columnNamesWithFonts[columnId]}</th>`);
				}
				textTable.appendChild(headerTr);

				const textColumnsSegments = textColumns.map(columnId => [columnId, unpackSegmented(columns[columnId])]);
				const tableHeight = Math.max(...textColumnsSegments.map(x => x[1].length));
				let recycledBitmap = undefined;
				for (let i = 0; i < tableHeight; ++i) {
					const tr = document.createElement('tr');
					tr.innerHTML = `<th>${i}</th>`;

					for (const [columnId, segments] of textColumnsSegments) {
						let text = segments[i];
						const td = document.createElement('td');
						tr.appendChild(td);
						if (!text) continue;

						if (0 <= gameFont.value && gameFont.value <= 3) {
							if (type === 'textboxes' || type === 'textboxes+fonts' || type === 'tables+textboxes+fonts' || type === 'fevent') {
								text = sliceDataView(text, 2, text.byteLength);
							}

							const alphabet = ['japanese', 'latin', 'korean', 'chinese'][gameFont.value];
							td.innerHTML = bisUnicode(text, alphabet).replaceAll('\n', '<br>');
						} else if (gameFont.value === 4) {
							// Hex View
							td.innerHTML = `<code>${bytes(0, text.byteLength, text)}</code>`;
						} else {
							// Use custom font
							const font = fonts.optionFonts[gameFont.value - 5];

							let width = 0, height = 0;
							if (type === 'textboxes' || type === 'textboxes+fonts' || type === 'tables+textboxes+fonts' || type === 'fevent') {
								width = text.getUint8(0) * 8;
								height = (text.getUint8(1) - 1) / 2 * 8;
								text = sliceDataView(text, 2, text.byteLength);
							}

							let altFonts = [];
							if (!isSimple) {
								// TOOD: verify
								if (columnId === 67) altFonts = [1, 2, 3, 4, 5];
								else if (columnId === 68) altFonts = [6, 7, 8, 9, 10];
								else if (columnId === 69) altFonts = [11, 12, 13, 14, 15];
								else if (columnId === 70) altFonts = [16, 17, 18, 19, 20];
								else if (columnId === 71) altFonts = [21, 22, 23, 24, 25];
								else if (columnId === 72) altFonts = [26, 27, 28, 29, 30];
								altFonts = altFonts.map(columnId => fontColumnsParsed.get(columnId));
							}

							const { bitmap, bitmapWidth, bitmapHeight, actualWidth } =
								fonts.textbox(text, font, altFonts, width, height, recycledBitmap, rocFonts, defaultRocFont, [1, 2][textSpacing.value]);

							const canvas = document.createElement('canvas');
							canvas.width = actualWidth;
							canvas.height = bitmapHeight;
							canvas.style.cssText = `width: ${actualWidth * canvasScale}px; height: ${bitmapHeight * canvasScale}px;`;

							const ctx = canvas.getContext('2d');
							ctx.putImageData(new ImageData(bufToU8Clamped(bitmap.slice(0, bitmapWidth * bitmapHeight)), bitmapWidth, bitmapHeight), 0, 0);
							td.appendChild(canvas);

							recycledBitmap = bitmap;
						}
					}

					textTable.appendChild(tr);
				}
			};
			updateTable();
		};
		updateFile();

		return messages;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Monsters                                                                                             |
	// +---------------------------------------------------------------------------------------------------------------+

	const monsters = (window.monsters = createSection('Monsters', (section) => {
		const monsters = {};

		// basically a rip straight from Yoshi Magic
		const monsterNameTable = unpackSegmented(fs.get('/BData/mfset_MonN.dat')).map(buf => unpackSegmented(buf));

		const table = document.createElement('table');
		table.className = 'bordered';
		section.appendChild(table);

		monsters.monsters = [];
		for (let i = 0; i < fsext.monsters.length; ++i) {
			const block = fsext.monsters[i];
			const nameIndex = block.getUint16(0, true);
			const script = block.getUint16(2, true);
			const sprite = block.getUint32(4, true);
			const level = block.getUint16(8, true);
			const hp = block.getUint16(10, true);
			const pow = block.getUint16(12, true);
			const def = block.getUint16(14, true);
			const spd = block.getUint16(16, true);

			const exp = block.getUint16(0x16, true);
			const coins = block.getUint16(0x18, true);

			let scriptName = `script ${str16(script)}`;
			if ((script >> 12) === 2) scriptName = `yo[${script & 0xfff}]`;
			else if ((script >> 12) === 4) scriptName = `ji[${script & 0xfff}]`;
			else if ((script >> 12) === 7) scriptName = `cf[${script & 0xfff}]`;

			let name;
			if (monsterNameTable[2]?.[nameIndex]) name = bisUnicode(monsterNameTable[2][nameIndex], 'latin');
			else name = bisUnicode(monsterNameTable[1][nameIndex], 'japanese');

			let spriteName = str32(sprite);
			if ((sprite >>> 24) === 0xc0) spriteName = `BObjPc[0x${(sprite & 0xffff).toString(16)}]`;
			if ((sprite >>> 24) === 0xc1) spriteName = `BObjMon[0x${(sprite & 0xffff).toString(16)}]`;
			if ((sprite >>> 24) === 0xc2) spriteName = `BObjUI[0x${(sprite & 0xffff).toString(16)}]`;

			addHTML(table, `<tr>
				<th>${i}</th>
				<td>${name}</td>
				<td>${spriteName}</td>
				<td>${scriptName}</td>
				<td>HP ${hp} / POW ${pow} / DEF ${def} / SPD ${spd}</td>
				<td>EXP ${exp} / Coins ${coins}</td>
			</tr>`);

			monsters.monsters.push({ name, script, sprite, level, hp, pow, def, spd, exp, coins });
		}

		return monsters;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Battle Scripts                                                                                       |
	// +---------------------------------------------------------------------------------------------------------------+

	const bai = (window.bai = createSection('Battle Scripts', (section) => {
		const bai = {};

		// preprocess commands
		const commands = bai.commands = [];
		for (const block of fsext.baiCommands) {
			const argc = block.getUint8(0);
			const args = [];
			for (let i = 0; i < (argc & 0x7f); ++i) {
				const type = i & 1
					? block.getUint8(1 + (i >> 1)) >> 4
					: block.getUint8(1 + (i >> 1)) & 0xf;
				args.push(type);
			}

			commands.push({ returns: !!(argc & 0x80), args });
		}

		const options = [
			['/BAI/BAI_atk_hk.dat', 0xd000, fsext.bai_atk_hk],
			// this file is not referenced in overlays, and has no IDs assigned to it
			['/BAI/BAI_atk_mt.dat', undefined, { segments: [fs.get('/BAI/BAI_atk_mt.dat')] }],
			['/BAI/BAI_atk_nh.dat', 0xa000, fsext.bai_atk_nh],
			['/BAI/BAI_atk_yy.dat', 0xc000, fsext.bai_atk_yy],
			['/BAI/BAI_item_ji.dat', 0x5000, fsext.bai_item_ji],
			['/BAI/BAI_mon_cf.dat', 0x7000, fsext.bai_mon_cf],
			['/BAI/BAI_mon_ji.dat', 0x4000, fsext.bai_mon_ji],
			['/BAI/BAI_mon_yo.dat', 0x2000, fsext.bai_mon_yo],
			['/BAI/BAI_scn_cf.dat', 0x6000, fsext.bai_scn_cf],
			['/BAI/BAI_scn_ji.dat', 0x3000, fsext.bai_scn_ji],
			['/BAI/BAI_scn_yo.dat', 0x1000, fsext.bai_scn_yo],
		];
		const fileSelect = dropdown(options.map(entry => `<code>${entry[1] ? str16(entry[1]) : '????'}</code> ${entry[0]}`), 0, () => update());
		section.appendChild(fileSelect);

		const scriptSelectNames = options.map(entry => {
			if (!entry[2].segments?.length) return ['(?)'];
			return entry[2].segments.map((x, i) => `${i}. (len 0x${x.byteLength.toString(16)})`);
		});

		const scriptRenderer = dropdown(['Renderer: simple', 'Renderer: pretty'], 1, () => updateScript());
		section.appendChild(scriptRenderer);

		let updateScript;
		let scriptSelect = dropdown([''], 0, () => updateScript());
		section.appendChild(scriptSelect);

		const refScanButton = button('Scan for References', () => {
			bai.scan();
			refScanButton.remove();
			update();
		});
		section.appendChild(refScanButton);

		const preview = document.createElement('div');
		section.appendChild(preview);

		bai.parse = script => {
			const headerU16 = bufToU16(script);
			const scriptU8 = bufToU8(script);

			const parsed = [];
			let o = 14;
			for (; o + 5 < script.byteLength;) {
				if (script.getUint8(o + 1) >= 3) {
					// array
					const offsetLeft = o;

					while (scriptU8[o] === 0xff) ++o;
					const composite = script.getUint16(o, true); o += 2;
					if ((composite >>> 12) !== 8) break;
					const type = (composite >> 8) & 0xf;
					if (type >= 8) break;
					const elements = composite & 0xff;
					o += [1, 2, 4, 1, 2, 4, 2, 4][type] * elements;

					while (scriptU8[o] === 0xff) ++o;

					parsed.push({ opcode: -1, args: [], offsetLeft, offsetRight: o });
					continue;
				}

				const opcode = script.getUint16(o, true);
				const variables = script.getUint32(o + 2, true);
				const command = commands[opcode];
				if (!command) break;
				const offsetLeft = o;

				o += 6;

				let returnTarget;
				if (command.returns) (returnTarget = script.getUint16(o, true), o += 2);
				
				const args = [];
				for (let i = 0; i < command.args.length; ++i) {
					const type = command.args[i];
					if (variables & (1 << i)) (args.push({ type: 'var', x: script.getUint16(o, true) }), o += 2);
					else if (type === 0) args.push({ type: 'u8', x: script.getUint8(o++) });
					else if (type === 1) (args.push({ type: 'u16', x: script.getUint16(o, true) }), o += 2);
					else if (type === 2) (args.push({ type: 'u32', x: script.getUint32(o, true) }), o += 4);
					else if (type === 3) args.push({ type: 's8', x: script.getInt8(o++) });
					else if (type === 4) (args.push({ type: 's16', x: script.getInt16(o, true) }), o += 2);
					else if (type === 5) (args.push({ type: 's32', x: script.getInt32(o, true) }), o += 4);
					else if (type === 6) (args.push({ type: 'fp88', x: script.getInt16(o, true) / 256 }), o += 2);
					else if (type === 7) (args.push({ type: 'fp2012', x: script.getInt32(o, true) / 4096 }), o += 4);
				}

				parsed.push({ opcode, returnTarget, args, offsetLeft, offsetRight: o });
			}

			if (o < script.byteLength)
				parsed.push({ opcode: -1, args: [], offsetLeft: o, offsetRight: script.byteLength });

			return parsed;
		};

		bai.scan = () => {
			// #1 : discover the monsters using any particular script
			const scriptToMonsterIds = new Map();
			for (let i = 0; i < monsters.monsters.length; ++i) {
				const { script } = monsters.monsters[i];
				const list = scriptToMonsterIds.get(script);
				if (list) list.push(i);
				else scriptToMonsterIds.set(script, [i]);
			}

			// #2 : scan all scripts for BA_0066 (load attack script) and BA_0065 (create description from monster id)
			const attackToInvokerReferences = new Map();
			const monsterToCreatorReferences = new Map();
			const creatorToMonsterReferences = new Map();
			for (const [path, scriptSpace, { segments }] of options) {
				if (scriptSpace === undefined) continue; // BAI_atk_mt cannot be loaded, anyway

				let type;
				if (path.includes('_atk_')) type = 'atk';
				else if (path.includes('_mon_')) type = 'mon';
				else if (path.includes('_scn_')) type = 'scn';

				for (let i = 0; i < segments.length; ++i) {
					const script = scriptSpace + i;
					for (const cmd of bai.parse(segments[i])) {
						if (cmd.opcode === 0x66) {
							// load attack script
							if (cmd.args[0].type === 'var') continue;

							const atkScript = cmd.args[0].x;
							const ref = attackToInvokerReferences.get(atkScript);
							if (ref) ref[type].add(script);
							else attackToInvokerReferences.set(atkScript, {
								atk: new Set(), mon: new Set(), scn: new Set(),
								[type]: new Set([script]),
							});
						} else if (cmd.opcode === 0x65) {
							// create monster from description id
							if (cmd.args[1].type === 'var') continue;

							const monsterId = cmd.args[1].x;
							const ref = monsterToCreatorReferences.get(monsterId);
							if (ref) ref[type].add(script);
							else monsterToCreatorReferences.set(monsterId, {
								atk: new Set(), mon: new Set(), scn: new Set(),
								[type]: new Set([script]),
							});

							const ref2 = creatorToMonsterReferences.get(script);
							if (ref2) ref2.add(monsterId);
							else creatorToMonsterReferences.set(script, new Set([monsterId]));
						}
					}
				}
			}

			// #3 : compile dropdown names
			// only add a number to the end of a monster's name if there are duplicates
			const monsterNamesSeen = new Set();
			const monsterNamesSeenTwice = new Set();
			for (const { name } of monsters.monsters) {
				if (monsterNamesSeen.has(name)) monsterNamesSeenTwice.add(name);
				else monsterNamesSeen.add(name);
			}
			const monsterNames = [];
			for (let i = 0; i < monsters.monsters.length; ++i) {
				const { name } = monsters.monsters[i];
				if (monsterNamesSeenTwice.has(name)) monsterNames[i] = `${name}(${i})`;
				else monsterNames[i] = name;
			}
			const scriptSpaces = ['', 'yo', 'yo', 'ji', 'ji', 'ji', 'cf', 'cf', '', '', 'nh', 'yy', 'hk', '', ''];
			const scriptName = id => scriptSpaces[id >> 12] + `[${id & 0xfff}]`;

			for (let i = 0; i < options.length; ++i) {
				const [path, scriptSpace, { segments }] = options[i];
				if (scriptSpace === undefined) continue;

				let type;
				if (path.includes('_atk_')) type = 'atk';
				else if (path.includes('_mon_')) type = 'mon';
				else if (path.includes('_scn_')) type = 'scn';

				for (let j = 0; j < segments.length; ++j) {
					const script = scriptSpace + j;
					const receiverParts = [];
					let invokerPart = '';

					// mon scripts are also references by the monsters themselves
					const atk = new Set();
					const mon = new Set();
					const scn = new Set();
					if (type === 'mon') {
						const refs = scriptToMonsterIds.get(script);
						if (refs) {
							receiverParts.push(refs.map(id => monsterNames[id]).join(', '));
							for (const monsterId of refs) {
								const invokers = monsterToCreatorReferences.get(monsterId);
								if (invokers?.atk.size) {
									for (const otherScript of invokers.atk) atk.add(scriptName(otherScript));
								}
								if (invokers?.mon.size) {
									for (const otherScript of invokers.mon) {
										if (script !== otherScript) mon.add(scriptName(otherScript));
									}
								}
								if (invokers?.scn.size) {
									for (const otherScript of invokers.scn) scn.add(scriptName(otherScript));
								}
							}
						}
					}

					if (type === 'atk') {
						const refs = attackToInvokerReferences.get(script);
						if (refs?.mon.size) {
							for (const monScript of refs.mon) {
								const monsterIds = scriptToMonsterIds.get(monScript);
								if (monsterIds) {
									for (const id of monsterIds) mon.add(monsterNames[id]);
								}
							}
						}
						if (refs?.atk.size) {
							for (const otherScript of refs.atk) atk.add(scriptName(otherScript));
						}
						if (refs?.scn.size) {
							for (const otherScript of refs.scn) scn.add(scriptName(otherScript));
						}
					}

					if (atk.size) receiverParts.push('atk: ' + [...atk].join(', '));
					if (mon.size) receiverParts.push('mon: ' + [...mon].join(', '));
					if (scn.size) receiverParts.push('scn: ' + [...scn].join(', '));

					let refs = creatorToMonsterReferences.get(script);
					if (refs) invokerPart = `→ ${[...refs].map(id => monsterNames[id]).join('; ')}`;

					const parts = [`${j}. (len ${segments[j].byteLength}) `];
					if (receiverParts.length) parts.push('← ' + receiverParts.join('; '));
					if (receiverParts.length && invokerPart) parts.push('; ');
					if (invokerPart) parts.push(invokerPart);
					scriptSelectNames[i][j] = parts.join('');
				}
			}

			// ATK: 0. (1234 len) ← Durmite(45), Durmite X(46), Biffdus(47), scn: yo[14]
			// MON: 1. (2345 len) Durmite(45) ← scn: yo[13], yo[15], atk: cf[3]
			// SCN: 2. (2345 len) → Durmite(45)
		};

		// This is for debugging only. It can compile a BAI script from a textual format very similar to what is output,
		// except you denote locations with @name
		// and you can pass those to parameters, or label an instruction with one, then wherever that label is used
		// will be replaced with a relative offset to that instruction
		// Example:
		// @player_turn var[0x9000] = CM_0008(1)
		// var[0x1234] = BA_0123(var[0x4000], 0, 0x1000, @label) // this is a comment
		// BA_0001()
		bai.encode = (str, dat) => {
			const lines = str.trim().split('\n');
			const labelInjectLocations = new Map();
			const labelLocations = new Map();

			// first pass: compute instructions, and add to labels map
			dat.setUint16(0, 6, true);
			labelInjectLocations.set('@other_monster_turn', [[2, 2]]);
			dat.setUint16(2, 0, true);
			labelInjectLocations.set('@init', [[4, 4]]);
			dat.setUint16(4, 0, true);
			labelInjectLocations.set('@monster_turn', [[6, 6]]);
			dat.setUint16(6, 0, true);
			labelInjectLocations.set('@player_turn', [[8, 8]]);
			dat.setUint16(8, 0, true);
			labelInjectLocations.set('@unknown5', [[10, 10]]);
			dat.setUint16(10, 0, true);
			labelInjectLocations.set('@unknown6', [[12, 12]]);
			dat.setUint16(12, 0, true);
			let o = 14;
			for (let i = 0; i < lines.length; ++i) {
				const L = 'L' + String(i + 1) + ' ';
				const line = lines[i].trim();
				if (!line) continue;

				const components = line.match(/^(@[A-Za-z0-9_]+)?\s*(?:var\[0x([0-9A-Fa-f]{4})\]\s*\=\s*)?(?:BA|CM)_([A-Fa-f0-9]{4})\(([^\)]*)\)(?:\s*\/\/.*)?$/);
				if (!components) throw `invalid line: ${line}`;

				const label = components[1];
				if (label) {
					if (labelLocations.has(label)) throw L + `Label ${label} already in use`;
					labelLocations.set(label, o);
				}

				const assignment = components[2];

				const opcode = parseInt(components[3], 16);
				const command = bai.commands[opcode];
				if (!command) throw L + `Command 0x${str16(opcode)} not found`;
				if (assignment && !command.returns) throw L + `Command 0x${str16(opcode)} does not return a value`;
				if (!assignment && command.returns) throw L + `Command 0x${str16(opcode)} must accept a return value`;

				let varflags = 0;
				const rawArgs = components[4] === '' ? [] : components[4].split(', ');
				if (rawArgs.length !== command.args.length) throw L + `Command 0x${str16(opcode)} expects ${command.args.length} args, got ${rawArgs.length}`;

				dat.setUint16(o, opcode, true); o += 2;
				const varflagsOffset = o; o += 4;
				if (command.returns) {
					dat.setUint16(o, parseInt(assignment, 16), true); o += 2;
				}

				const labelInjectOffsetRightTodos = [];
				const write = (i, x) => {
					if (command.args[i] === 0) dat.setUint8(o++, x);
					else if (command.args[i] === 1) (dat.setUint16(o, x, true), o += 2);
					else if (command.args[i] === 2) (dat.setUint32(o, x, true), o += 4);
					else if (command.args[i] === 3) (dat.setInt8(o++, x));
					else if (command.args[i] === 4) (dat.setInt16(o, x, true), o += 2);
					else if (command.args[i] === 5) (dat.setInt32(o, x, true), o += 4);
					else if (command.args[i] === 6) (dat.setInt16(o, x * 256, true), o += 2);
					else if (command.args[i] === 7) (dat.setInt32(o, x * 4096, true), o += 4);
				};
				for (let i = 0; i < rawArgs.length; ++i) {
					const x = rawArgs[i];
					const decimalMatch = x.match(/^\-?\d+(?:\.\d+)?$/);
					if (decimalMatch) {
						write(i, Number(x));
						continue;
					}

					const hexMatch = x.match(/^\-?0x([0-9A-Fa-f]+)$/);
					if (hexMatch) {
						write(i, parseInt(hexMatch[1], 16));
						continue;
					}

					const labelMatch = x.match(/^@[A-Za-z0-9_]+$/);
					if (labelMatch) {
						const list = labelInjectLocations.get(x);
						const pair = [o, 0];
						labelInjectOffsetRightTodos.push(pair);
						if (list) list.push(pair);
						else labelInjectLocations.set(x, [pair]);
						write(i, 0);
						continue;
					}

					const varMatch = x.match(/^var\[0x([0-9A-Fa-f]{4})\]$/);
					if (varMatch) {
						varflags |= 1 << i;
						dat.setUint16(o, parseInt(varMatch[1], 16), true); o += 2;
						continue;
					}

					throw L + `Invalid argument ${x}`;
				}

				dat.setUint32(varflagsOffset, varflags, true);
				for (const todo of labelInjectOffsetRightTodos) {
					todo[1] = o;
				}
			}

			// second pass: inject label locations
			for (const [label, locations] of labelInjectLocations) {
				const loc = labelLocations.get(label);
				if (!loc) {
					console.warn(`Label ${label} not assigned to any instruction, leaving as zero`);
					continue;
				}

				for (let i = 0; i < locations.length; ++i) {
					const [writeAt, base] = locations[i]
					dat.setInt16(writeAt, loc - base, true);
				}
			}

			return sliceDataView(dat, 0, o);
		};

		bai.actorAttribute = x => {
			switch (x) {
				case 3: return 'x';
				case 4: return 'y';
				case 5: return 'z';
				case 9: return 'home_x';
				case 10: return 'home_y';
				case 11: return 'home_z';
				case 24: return 'animation';
				case 32: return 'level';
				case 33: return 'max_hp';
				case 34: return 'hp';
				case 35: return 'spd'; // why are you here
				case 36: return 'pow';
				case 37: return 'def';
				case 47: return 'invincible';
				case 63: return 'sprite';
			}
		};

		bai.monsterAttribute = x => {
			switch (x) {
				case 2: return 'sprite';
				case 12: return 'flying';
			}
		};

		bai.spriteFile = x => {
			if ((x >>> 24) === 0xc0) return `BObjPc[0x${(x & 0xffff).toString(16)}]`;
			if ((x >>> 24) === 0xc1) return `BObjMon[0x${(x & 0xffff).toString(16)}]`;
			if ((x >>> 24) === 0xc2) return `BObjUI[0x${(x & 0xffff).toString(16)}]`;
			return '(?)';
		};

		const operators = ['==', '!=', '<', '>', '<=', '>=', '&', '|', '^']; // unary operators are unused
		const builtin = x => `<span style="color: var(--peach);">${x}</span>`;
		const fn = x => `<span style="color: var(--blue);">${x}</span>`;
		const keyword = x => `<span style="color: var(--mauve);">${x}</span>`;
		const constant = x => `<span style="color: var(--peach);">${x}</span>`;
		const storage = x => `<span style="color: var(--yellow);">${x}</span>`;
		const operator = x => `<span style="color: var(--teal);">${x}</span>`;
		const text = x => `<span style="color: var(--text);">${x}</span>`;
		const location = x => `<span style="color: var(--sapphire);">${x}</span>`;
		const string = x => `<span style="color: var(--green);">${x}</span>`;
		bai.value = (x, context) => {
			if (context === 'actor') {
				if (x === 0x1000) return constant('MARIO');
				if (x === 0x1001) return constant('LUIGI');
				if (x === 0x1002) return constant('BOWSER');
				if (0x0000 <= x && x <= 0x0fff) return constant('UI_' + (x & 0xfff));
				if (0x2000 <= x && x <= 0x2fff) return constant('MONSTER_' + (x & 0xfff));
				if (0x3000 <= x && x <= 0x3fff) return constant('NPC_ATK_' + (x & 0xfff));
				if (0x4000 <= x && x <= 0x4fff) return constant('NPC_' + (x & 0xfff));
				if (0xa000 <= x && x <= 0xafff) return constant('DESC_ATK_' + (x & 0xfff));
				if (0xb000 <= x && x <= 0xbfff) return constant('DESCRIPTION_' + (x & 0xfff));
			}
			if (context === 'action_block')
				return constant([, 'JUMP', 'HAMMER', 'FLEE', 'ITEM', 'SPECIAL', 'PUNCH'][x] || x);
			if (context === 'coordinate') return constant(['X', 'Y', 'Z'][x] || x);
			if (context === 'party') {
				if (x === 2) return constant('MONSTERS');
				if (x === 513) return constant('PLAYERS');
			}
			if (context === 'positioning') return constant(['ABSOLUTE', 'RELATIVE'][x] || x);

			if (context === 'hex16') return constant('0x' + str16(x));
			if (context === 'hex32') return constant('0x' + str32(x));
			if (context === 'bool' && x === 0) return constant('false');
			if (context === 'bool' && x === 1) return constant('true');
			return constant(x);
		};
		bai.variable = (x, context) => {
			if (x === 0x4000) return storage('brg_self');
			if (x === 0x4002) return text('brg_target');
			if (x === 0x4008) return text('brg_buttons_held');
			if (x === 0x4009) return text('brg_buttons_pressed');
			if (x === 0x400a) return text('brg_buttons_released');
			if (x === 0x400b) return text('brg_buttons_released2');
			if (x === 0x400e) return text('brg_party_type');
			return text('var') + `[${constant('0x' + str16(x))}]`;
		};
		bai.command = (script, opcode, returnTarget, args, offsetLeft, offsetRight, functionLabels) => {
			const arg = (i, context) => {
				if (args[i].type === 'var') return bai.variable(args[i].x, context);
				else return bai.value(args[i].x, context);
			}
			const argsConcat = () => args.map((_,i) => arg(i)).join(', ');
			const pm = x => x < 0 ? String(x) : '+' + x;

			const rp = returnTarget !== undefined ? `${bai.variable(returnTarget)} ${operator('=')} ` : '';

			switch (opcode) {
				case 1: return keyword('return');
				case 2: {
					const to = offsetRight + args[4].x;
					return `${keyword('if')} ${args[3].x ? '' : operator('!')}(${arg(1)} ${operator(operators[args[0].x])} ${arg(2)}) ${keyword('goto')} ${location(str16(to))} // (${pm(args[4].x)})`;
				}
				case 3: {
					const to = offsetRight + args[1].x;
					if (args[0].x === 1) return fn(functionLabels.get(to)) + '()';
					else return `${keyword('goto')} ${location(str16(to))} // (${pm(args[1].x)}) type ${args[0].x}`;
				}
				case 4: return builtin('wait') + `(${arg(0)})`;
				case 5: return builtin('stack_push') + `(${arg(0)})`;
				case 7: {
					const to = offsetRight + args[3].x;
					return `${keyword('if')} (${builtin('stack_compare')}(${arg(0)}, ${arg(1)}, ${arg(2)})) ${keyword('goto')} ${location(str16(to))} // (${pm(args[3].x)})`;
				}
				case 8: return rp + arg(0);
				case 9: return rp + arg(0) + operator(' + ') + arg(1);
				case 0xa: return rp + arg(0) + operator(' - ') + arg(1);
				case 0xb: return rp + arg(0) + operator(' * ') + arg(1);
				case 0xc: return rp + arg(0) + operator(' / ') + arg(1);
				case 0xd: return rp + arg(0) + operator(' % ') + arg(1);
				case 0xe: return rp + arg(0) + operator(' << ') + arg(1);
				case 0xf: return rp + arg(0) + operator(' >> ') + arg(1);
				case 0x10: return rp + arg(0) + operator(' & ') + arg(1);
				case 0x11: return rp + arg(0) + operator(' | ') + arg(1);
				case 0x12: return rp + arg(0) + operator(' ^ ') + arg(1);
				case 0x13: return rp + operator('-') + arg(0);
				case 0x14: return rp + builtin('bool') + `(${arg(0)})`;
				case 0x15: return rp + operator('~') + arg(0);
				case 0x16: return bai.variable(returnTarget) + operator('++');
				case 0x17: return bai.variable(returnTarget) + operator('--');
				case 0x18: return `${bai.variable(returnTarget)} ${operator('+=')} ${arg(0)}`;
				case 0x19: return `${bai.variable(returnTarget)} ${operator('-=')} ${arg(0)}`;
				case 0x1a: return `${bai.variable(returnTarget)} ${operator('*=')} ${arg(0)}`;
				case 0x1b: return `${bai.variable(returnTarget)} ${operator('/=')} ${arg(0)}`;
				case 0x1c: return `${bai.variable(returnTarget)} ${operator('%=')} ${arg(0)}`;
				case 0x1d: return `${bai.variable(returnTarget)} ${operator('<<=')} ${arg(0)}`;
				case 0x1e: return `${bai.variable(returnTarget)} ${operator('>>=')} ${arg(0)}`;
				case 0x1f: return `${bai.variable(returnTarget)} ${operator('&=')} ${arg(0)}`;
				case 0x20: return `${bai.variable(returnTarget)} ${operator('|=')} ${arg(0)}`;
				case 0x21: return `${bai.variable(returnTarget)} ${operator('^=')} ${arg(0)}`;
				case 0x22: return rp + builtin('sqrt') + `(${arg(0)})`;
				case 0x23: return rp + builtin('invsqrt') + `(${arg(0)})`;
				case 0x24: return rp + `${constant(1)} ${operator('/')} ${arg(0)}`;
				case 0x25: return rp + builtin('sin') + `(${arg(0)})`;
				case 0x26: return rp + builtin('cos') + `(${arg(0)})`;
				case 0x27: return rp + builtin('atan') + `(${arg(0)})`;
				case 0x28: return rp + builtin('atan2') + `(${arg(0)}, ${arg(1)})`;
				case 0x29: return rp + builtin('random') + `(${arg(0)})`;
				case 0x2a: return rp + `${arg(0)} [fx32]`;
				case 0x2b: return rp + `${arg(0)} ${operator('+')} ${arg(1)} [fx32]`;
				case 0x2c: return rp + `${arg(0)} ${operator('-')} ${arg(1)} [fx32]`;
				case 0x2d: return rp + `${arg(0)} ${operator('*')} ${arg(1)} [fx32]`;
				case 0x2e: return rp + `${arg(0)} ${operator('/')} ${arg(1)} [fx32]`;
				case 0x2f: return rp + `${arg(0)} ${operator('%')} ${arg(1)} [fx32]`;
				case 0x30: return rp + builtin('fx32_to_int') + `(${arg(0)})`;
				case 0x31: return rp + builtin('trunc') + `(${arg(0)}) [fx32]`;
				case 0x32: return rp + builtin('sqrt') + `(${arg(0)}) [fx32]`;
				case 0x33: return rp + builtin('invsqrt') + `(${arg(0)}) [fx32]`;
				case 0x34: return rp + `${constant(1)} ${operator('/')} ${arg(0)} [fx32]`;
				case 0x35: return rp + builtin('sin') + `(${arg(0)}) [fx32]`;
				case 0x36: return rp + builtin('cos') + `(${arg(0)}) [fx32]`;
				case 0x37: return rp + builtin('atan') + `(${arg(0)}) [fx32]`;
				case 0x38: return rp + builtin('atan2') + `(${arg(0)}, ${arg(1)}) [fx32]`;
				case 0x39: {
					const to = offsetRight + args[0].x;
					return rp + builtin('load_data_from_array') + `(${location(str16(to))}, ${arg(1)})`;
				}
				case 0x3a: {
					const to = offsetRight + args[0].x;
					return rp + builtin('load_data') + `(${location(str16(to))})`;
				}
				case 0x3b: {
					const to = offsetRight + args[0].x;
					return builtin('debugln') + `(${string('"' + shiftJis(script, to) + '"')})`;
				}
				case 0x3c: {
					const to = offsetRight + args[0].x;
					return builtin('debug') + `(${string('"' + shiftJis(script, to) + '"')})`;
				}
				case 0x3d: return builtin('debug_bin') + `(${arg(0)})`;
				case 0x3e: return builtin('debug_dec') + `(${arg(0)})`;
				case 0x3f: return builtin('debug_hex') + `(${arg(0)})`;
				case 0x41: return rp + builtin('add_coins') + `(${arg(0)})`;
				case 0x43: return rp + builtin('get_item_amount') + `(${arg(0)})`;
				case 0x44: return rp + builtin('add_items') + `(${arg(0)})`;
				case 0x45: return rp + builtin('get_player_stat') + `(${arg(0)}, ${arg(1)})`;
				case 0x46: return rp + builtin('set_player_stat') + `(${argsConcat()})`;
				// end CM_xxxx commands, begin BA_xxxx commands
				case 0x47: {
					const to = offsetRight + args[2].x;
					return rp + fn('call_then_bind') + `(${arg(0, 'actor')}, ${arg(1)}, ${fn(functionLabels.get(to))})`;
				}
				case 0x48: {
					const to = offsetRight + args[2].x;
					return rp + fn('bind_and_defer') + `(${arg(0, 'actor')}, ${arg(1)}, ${fn(functionLabels.get(to))})`;
				}
				case 0x49: {
					const to = offsetRight + args[2].x;
					return rp + fn('spawn_actor_thread') + `(${arg(0, 'actor')}, ${arg(1)}, ${fn(functionLabels.get(to))})`;
				}
				case 0x4a: return rp + fn('join_actor_thread') + `(${arg(0, 'actor')})`;
				case 0x4e: return rp + fn('BA_004e') + `(${arg(0, 'actor')})`;
				case 0x58: return rp + fn('party_turn_check') + `(${arg(0, 'party')})`;
				case 0x59: return rp + fn('party_turn_wait') + `(${arg(0, 'party')}, ${arg(1)})`;
				case 0x63: return rp + fn('desc_by_sprite_id') + `(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}) // ${bai.spriteFile(args[1].x)}`;
				case 0x65: {
					let comment;
					if (args[1].type !== 'var') comment = ' // ' + monsters.monsters[args[1].x]?.name ?? '(?)';
					else comment = ' // (?)';
					return rp + fn('desc_by_monster_id') + `(${arg(0, 'actor')}, ${arg(1)})` + comment;
				}
				case 0x66: {
					let scriptFile = '(?)';
					if (args[0].x >= 0xd000) scriptFile = 'BAI_atk_hk';
					else if (args[0].x >= 0xc000) scriptFile = 'BAI_atk_yy';
					else if (args[0].x >= 0xa000) scriptFile = 'BAI_atk_nh';
					return rp + fn('load_atk_script') + `(${arg(0, 'hex16')}) // ${scriptFile} ${args[0].x & 0xfff}`;
				}
				case 0x68: return rp + fn('desc_by_sprite_id_load') + `(${arg(0, 'actor')})`;
				case 0x69: return rp + fn('desc_by_monster_id_load') + `(${arg(0, 'actor')})`;
				case 0x6a: return rp + fn('load_atk_script2') + '()';
				case 0x6d: return rp + fn('npc_init') + `(${arg(0, 'actor')})`;
				case 0x6f: return rp + fn('monster_apply_desc') + `(${arg(0, 'actor')}, ${arg(1, 'actor')})`;
				case 0x71: {
					let bmapK = '(?)';
					let bmapML = '(?)';
					if (args[0].type !== 'var') {
						if (args[0].x === -1) bmapK = 'default';
						else bmapK = '0x' + str8(args[0].x / 8);
					}
					if (args[1].type !== 'var') {
						if (args[1].x === -1) bmapML = 'default';
						else bmapML = '0x' + str8(args[1].x / 8);
					}
					return rp + fn('set_battle_background') + `(${arg(0)}, ${arg(1)}) // bowser bmap = ${bmapK}, m&l bmap = ${bmapML}`;
				}
				case 0x73: {
					const counterattack = constant(['NOTHING', 'JUMP', 'HAMMER', 'PUNCH', 'SHELL'][args[1].x] || args[1].x);
					return rp + fn('player_set_counterattack') + `(${arg(0, 'actor')}, ${counterattack})`;
				}
				case 0x7b: return rp + fn('disable_action_block') + `(${arg(0, 'action_block')}, ${arg(1, 'bool')})`;
				case 0x7e: return rp + fn('end_battle') + `(${arg(0)}, ${arg(1)})`;
				case 0xad: return rp + fn('select_coordinate') + `(${arg(0)}, ${arg(1)}, ${arg(2)}, ${arg(3, 'coordinate')})`;
				case 0xbf: {
					let attribute = bai.actorAttribute(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					return rp + fn('actor_attr_get') + `(${arg(0, 'actor')}, ${attribute})`;
				}
				case 0xc0: {
					let attribute = bai.actorAttribute(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					let value;
					switch (args[1].x) {
						case 47: value = arg(2, 'bool'); break; // .invincible
						case 63: value = arg(2, 'hex32'); break; // sprite
						default: value = arg(2);
					}
					return rp + fn('actor_attr_set') + `(${arg(0, 'actor')}, ${attribute}, ${value})`;
				}
				case 0xc1: {
					let attribute = bai.actorAttribute(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					return rp + fn('actor_attr_set_fx32') + `(${arg(0, 'actor')}, ${attribute}, ${arg(2)})`;
				}
				case 0xc6: {
					let attribute = bai.monsterAttribute(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					return rp + fn('monster_get_attribute') + `(${arg(0, 'actor')}, ${attribute})`;
				}
				case 0xc8: return rp + fn('monster_kill') + `(${arg(0, 'actor')})`;
				case 0xc9: return rp + fn('actor_despawn') + `(${arg(0, 'actor')})`;
				case 0xd3: return rp + fn('npc_apply_desc') + `(${arg(0, 'actor')}, ${arg(1, 'actor')})`;
				case 0xe7: return rp + fn('actor_move') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'positioning')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, speed=${arg(6)})`;
				case 0xe8: return rp + fn('actor_move_fixed_duration') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'positioning')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, duration=${arg(6)})`;
				case 0xe9: return rp + fn('actor_move_around_actor') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'actor')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, speed=${arg(6)})`;
				case 0xea: return rp + fn('actor_move_around_actor_fixed_duration') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'actor')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, duration=${arg(6)})`;
				case 0xeb: return rp + fn('actor_move_wait') + `(${arg(0, 'actor')}, ${arg(1)})`;
				case 0xef: return rp + fn('actor_set_position') + `(${arg(0, 'actor')}, ${arg(1, 'positioning')}, ${arg(2)}, ${arg(3)}, ${arg(4)})`;
				case 0xf0: return rp + fn('actor_set_position_around_actor') + `(${arg(0, 'actor')}, ${arg(1, 'actor')}, ${arg(2)}, ${arg(3)}, ${arg(4)})`;
				case 0xf3: return rp + fn('actor_set_home') + `(${arg(0, 'actor')}, ${arg(1, 'positioning')}, ${arg(2)}, ${arg(3)}, ${arg(4)})`;
				case 0x10f: return rp + fn('actor_jump') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)}, height=${arg(3)}, speed=${arg(4)})`;
				case 0x121: return rp + fn('spawn_monster_atk_thread') + `(${arg(0, 'actor')}, ${arg(1, 'actor')})`;
				case 0x122: return rp + fn('join_monster_atk_thread') + `(${arg(0, 'actor')})`;
				case 0x124: return rp + fn('monster_set_damage_victim') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'actor')}, ${arg(3)})`;
				case 0x125: return rp + fn('monster_set_damage_victims') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)})`;
				case 0x126: return rp + fn('monster_clear_damage_victims') + `(${arg(0, 'actor')})`;
				case 0x132: return rp + fn('play_boss_death_animation') + `(${arg(0)}, ${arg(1, 'actor')}, ${arg(2, 'actor')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ${arg(6)})`;
				case 0x133: return rp + fn('play_boss_death_animation_0133') + `(${argsConcat()})`;
				case 0x134: return rp + fn('play_boss_death_animation_0134') + `(${argsConcat()})`;
				case 0x13b: return rp + fn('wait_for_boss_death_animation') + `(${argsConcat()})`;
				case 0x1ee: {
					let file = '(?)';
					if (args[0].x === 24) file = 'BMes_cf';
					else if (args[0].x === 23) file = 'BMes_ji';
					else if (args[0].x === 22) file = 'BMes_yo';
					return rp + fn('load_messages') + `(${arg(0)}, ${arg(1)}) // ${file} table 0x${(args[1].x + 1).toString(16)}`;
				}
				case 0x1ef: return rp + fn('load_messages2') + '()';
				case 0x1f1: return rp + fn('textbox_say') + `(${argsConcat()})`;
				case 0x1f2: return rp + fn('textbox_wait') + `(${arg(0)})`;
				case 0x1fc: return rp + fn('play_sound_directional') + `(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ${arg(6)})`;
				case 0x1fd: return rp + fn('play_sound_directional_handle') + `(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ${arg(6)})`;
				case 0x1fe: return rp + fn('play_sound') + `(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ${arg(6)})`;
				case 0x1ff: return rp + fn('play_sound_handle') + `(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ${arg(6)})`;
				case 0x200: return rp + fn('stop_sound') + `(${arg(0)})`;
				case 0x201: return rp + fn('set_music') + `(${arg(0)}) // ${sound.names[args[0].x] || '(?)'}`;
				case 0x202: return rp + fn('set_music2') + `(${arg(0)}) // ${sound.names[args[0].x] || '(?)'}`;
				case 0x203: return rp + fn('fade_out_music') + `(${arg(0)})`;
				case 0x204: {
					const to = offsetRight + args[5].x;
					return `${keyword('if')} ${args[4].x ? '' : '!'}((${arg(1)} ${operator(operators[args[0].x])} ${arg(2)}) ${operator('==')} ${arg(3)}) ${keyword('goto')} ${location(str16(to))} // (${pm(args[5].x)})`;
				}
				case 0x205: {
					const to = offsetRight + args[4].x;
					let key = bai.actorAttribute(args[2].x);
					if (key) key = text(key);
					else key = text('attr' + args[2].x);

					return `${keyword('if')} (${arg(1, 'actor')}.${key} ${operator(operators[args[0].x])} ${arg(3)}) ${keyword('goto')} ${location(str16(to))} // (${pm(args[4].x)})`;
				}
				case 0x206: {
					const to = offsetRight + args[2].x;
					return rp + fn('BA_0206') + `(${arg(0, 'actor')}, ${arg(1)}, ${location(str16(to))}) // (${pm(args[2].x)})`;
				}
				case 0x207: {
					const to = offsetRight + args[3].x;
					return rp + fn('BA_0207') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)}, ${location(str16(to))}) // (${pm(args[3].x)})`;
				}
				case 0x209: {
					const to = offsetRight + args[3].x;
					return rp + fn('BA_0209') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)}, ${location(str16(to))}) // (${pm(args[3].x)})`;
				}
				case 0x213: return rp + fn('random_attack_target') + `(${arg(0)}, ${arg(1)})`;
				case 0x216: return rp + fn('actor_is_monster') + `(${arg(0, 'actor')})`;
				case 0x219: return rp + fn('monster_next_slot') + '()';
				case 0x21a: return rp + fn('desc_next_slot') + '()';
				case 0x21b: return rp + fn('desc_by_sprite_id_cached') + `(${arg(0)}, ${arg(1, 'hex32')}) // ${bai.spriteFile(args[1].x)}`;
				case 0x21c: {
					let comment;
					if (args[0].type !== 'var') comment = ' // ' + monsters.monsters[args[0].x]?.name ?? '(?)';
					else comment = ' // (?)';
					return rp + fn('desc_by_monster_id_cached') + `(${arg(0)})` + comment;
				}
			}

			// defaults
			if (opcode <= 0x46) return rp + fn('CM_' + str16(opcode)) + `(${argsConcat()})`;
			else return rp + fn('BA_' + str16(opcode)) + `(${argsConcat()})`;
		};

		const update = () => {
			preview.innerHTML = '';

			const segments = options[fileSelect.value]?.[2]?.segments;
			if (!segments) {
				preview.innerHTML = 'No segments/offsets for this file for this game version';
				scriptSelect.style.display = 'none';
				return;
			}

			const segmentNames = scriptSelectNames[fileSelect.value];
			scriptSelect.replaceWith(scriptSelect = dropdown(segmentNames, 0, () => updateScript()));

			updateScript = () => {
				const script = segments[scriptSelect.value];
				preview.innerHTML = '';

				if (scriptRenderer.value === 0) {
					// Renderer: basic
					const eventOffsets = new Map();
					eventOffsets.set(14, 'default_init'); // might be overwritten by a *real* handler

					const names = ['other_monster_turn', 'init', 'monster_turn', 'player_turn', 'unknown5', 'unknown6'];
					const offsetList = [];
					for (let i = 0; i < 6; ++i) {
						const offset = script.getInt16(i * 2 + 2, true);
						if (!offset) continue;
						const loc = offset + i * 2 + 2;
						eventOffsets.set(loc, names[i]);
						offsetList.push(`<li>${names[i]} @ <code>${str16(loc)}</code></li>`);
					}

					if (offsetList.length) addHTML(preview, `<ul>${offsetList.join('')}</ul>`);

					const parts = [];
					let o = 14;
					for (; o + 5 < script.byteLength;) {
						const startO = o;
						const cmd = script.getUint16(o, true);
						const flags = script.getUint32(o + 2, true);
						const command = commands[cmd];
						if (!command) break;

						let prefix = `<span style="color: var(--fg-dim);">${str16(o)}</span> `;
						const evOffset = eventOffsets.get(o);
						if (evOffset) prefix = `<span style="color: var(--fg-dim);">${str16(o)} ${evOffset}</span> `;
						else prefix = `<span style="color: var(--fg-dim);">${str16(o)}</span> `;
						o += 6;

						if (command.returns) {
							prefix += `var[0x${str16(script.getUint16(o, true))}] = `;
							o += 2;
						}

						const args = [];
						for (let i = 0; i < command.args.length; ++i) {
							if (flags & (1 << i)) {
								args.push(`var[0x${str16(script.getUint16(o, true))}]`);
								o += 2; // variable
							} else if (command.args[i] === 0) (args.push(script.getUint8(o)), ++o); // u8
							else if (command.args[i] === 1) (args.push(script.getUint16(o, true)), o += 2); // u16
							else if (command.args[i] === 2) (args.push(script.getUint32(o, true)), o += 4); // u32
							else if (command.args[i] === 3) (args.push(script.getInt8(o)), ++o); // s8
							else if (command.args[i] === 4) (args.push(script.getInt16(o, true)), o += 2); // s16
							else if (command.args[i] === 5) (args.push(script.getInt32(o, true)), o += 4); // s32
							else if (command.args[i] === 6) {
								const x = script.getInt16(o, true);
								args.push(`(fx16)${x / 256}`);
								o += 2; // fixed-point (8.8?)
							} else if (command.args[i] === 7) {
								const x = script.getInt32(o, true);
								args.push(`(fx32)${x / 4096}`);
								o += 4; // fixed-point (20.12)
							}
						}

						if (o > script.byteLength) break;

						if (cmd <= 0x46) parts.push(`${prefix}CM_${str16(cmd)}(${args.join(', ')})`);
						else parts.push(`${prefix}BA_${str16(cmd)}(${args.join(', ')})`);
					}

					addHTML(preview, `<div><code>${parts.map(x => `<div>${x}</div>`).join(' ')}</code></div>`);
				} else if (scriptRenderer.value === 1) {
					// Renderer: colorful + flow
					const parsed = bai.parse(script);

					const arg = ({ type, x }, context) => {
						if (type === 'var') return bai.variable(x, context);
						else return bai.value(x, context);
					};
					const operators = ['==', '!=', '<', '>', '<=', '>=', '&', '|', '^']; // unary operators unused

					// #1 : prepare quick index
					const offsetToCommandIdx = new Map();
					for (let i = 0; i < parsed.length; ++i) offsetToCommandIdx.set(parsed[i].offsetLeft, i);

					// #2 : find function calls. jumps won't happen between functions.
					const functionLabels = new Map();
					functionLabels.set(0xe, 'default_init');
					for (const cmd of parsed) {
						let offset;
						if (cmd.opcode === 3 && cmd.args[0].x === 1) offset = cmd.args[1].x;
						if (cmd.opcode === 0x47 || cmd.opcode === 0x48 || cmd.opcode === 0x49) offset = cmd.args[2].x;

						if (offset !== undefined) {
							const to = cmd.offsetRight + offset;
							functionLabels.set(to, `fun_${str16(to)}`);
						}
					}

					const headerU16 = bufToU16(script);
					if (headerU16[1]) functionLabels.set(headerU16[1] + 2, 'other_monster_turn');
					if (headerU16[2]) functionLabels.set(headerU16[2] + 4, 'init');
					if (headerU16[3]) functionLabels.set(headerU16[3] + 6, 'monster_turn');
					if (headerU16[4]) functionLabels.set(headerU16[4] + 8, 'player_turn');
					if (headerU16[5]) functionLabels.set(headerU16[5] + 10, 'unknown5');
					if (headerU16[6]) functionLabels.set(headerU16[6] + 12, 'unknown6');

					// #3 : replace tree with functions, and explore those functions
					const tree = [...parsed];
					for (let i = 0; i < tree.length; ++i) {
						const label = functionLabels.get(tree[i].offsetLeft);
						if (!label) continue;

						// function found: go until the next function
						let fnEnd = i;
						for (let j = i + 1; j < tree.length; ++j) {
							if (tree[j].opcode === -1) break;
							if (functionLabels.has(tree[j].offsetLeft)) break;
							fnEnd = j;
						}

						const children = tree.splice(i, fnEnd - i + 1);
						tree.splice(i, 0, {
							separators: [`${keyword('def')} ${fn(label)}() {`, `}`],
							content: [children],
							offsetLeft: undefined /* children[0].offsetLeft */,
							offsetsMiddle: [],
							offsetRight: undefined /* children[children.length - 1].offsetRight */,
						});

						const explore = branch => {
							branchLoop: for (let j = 0; j < branch.length; ++j) {
								const outer = branch[j];
								// BA_0002(op, a, b, 0, +offset)
								if (outer.opcode === 2 && outer.args[3].x === 0 && outer.args[4].x > 0) {
									const to = outer.offsetRight + outer.args[4].x;
									let leftIdx = j + 1;
									const left = branch[leftIdx];
									let rightIdx = leftIdx;
									for (let k = leftIdx + 1; k < branch.length; ++k) {
										if (branch[k].offsetLeft === to) break;
										rightIdx = k;
									}
									const right = branch[rightIdx];
									if (!left || !right) continue;

									// make sure all jumps within this block STAY within this block.
									// because if they didn't, the expansion would be even more confusing
									for (let k = leftIdx; k < rightIdx; ++k) {
										if (branch[k].opcode === 2) {
											const withinTo = branch[k].offsetRight + branch[k].args[4].x;
											if (left.offsetLeft <= withinTo && withinTo <= right.offsetRight);
											else continue branchLoop;
										} else if (branch[k].opcode === 3 && branch[k].args[0].x !== 1) {
											const withinTo = branch[k].offsetRight + branch[k].args[1].x;
											if (left.offsetLeft <= withinTo && withinTo <= right.offsetRight);
											else continue branchLoop;
										}
									}

									// if the last command in the if-block is a jump (NOT a function call), this could
									// be an if-else block instead
									if (right.opcode === 3 && right.args[0].x !== 1) {
										const withinTo = right.offsetRight + right.args[1].x;
										if (right.offsetRight < withinTo) {
											// this is an if-else block
											const ifLeftIdx = leftIdx;
											const ifRightIdx = rightIdx - 1;
											const elseLeftIdx = rightIdx + 1;
											let elseRightIdx = elseLeftIdx;
											for (let k = elseLeftIdx; k < branch.length; ++k) {
												if (branch[k].offsetLeft === withinTo) break;
												elseRightIdx = k;
											}
											const elseRight = branch[elseRightIdx];
											if (elseRight) {
												// don't do any validation yet, let's see what happens
												const childrenElse = branch.splice(elseLeftIdx, elseRightIdx - elseLeftIdx + 1);
												const childrenIf = branch.splice(ifLeftIdx, ifRightIdx - ifLeftIdx + 1);
												const ifelse = branch[j] = {
													separators: [`${keyword('if')} (${arg(outer.args[1])} ${operator(operators[outer.args[0].x])} ${arg(outer.args[2])}) {`, `} ${keyword('else')} {`, `}`],
													content: [childrenIf, childrenElse],
													offsetLeft: outer.offsetLeft,
													offsetsMiddle: [right.offsetLeft],
													offsetRight: undefined /* elseRight.offsetRight */,
												};
												branch.splice(j + 1, 1); // delete the "else" command

												explore(childrenIf);
												explore(childrenElse);

												if (childrenElse.length === 1 && childrenElse[0].separators) {
													const inner = childrenElse[0];
													// TODO maybe won't look too right if i introduce a loop { or smth
													ifelse.separators.pop();
													ifelse.separators.pop();
													ifelse.separators.push(`} ${keyword('else')} ${inner.separators[0]}`);
													for (let k = 1; k < inner.separators.length; ++k) {
														ifelse.separators.push(inner.separators[k]);
													}

													ifelse.offsetsMiddle.pop();
													ifelse.offsetsMiddle.push(inner.offsetLeft);
													ifelse.offsetsMiddle.push(...inner.offsetsMiddle);

													ifelse.content.pop();
													ifelse.content.push(...inner.content);
												}
												continue;
											}
										}
									}

									const children = branch.splice(leftIdx, rightIdx - leftIdx + 1);
									branch[j] = { // replace `outer` with a block
										separators: [`${keyword('if')} (${arg(outer.args[1])} ${operator(operators[outer.args[0].x])} ${arg(outer.args[2])}) {`, `}`],
										content: [children],
										offsetLeft: outer.offsetLeft,
										offsetsMiddle: [],
										offsetRight: undefined /*right.offsetRight*/,
									};
									explore(children);
								}
							}
						};
						explore(children);
					}

					const explore = (branch, indent) => branch.map(block => {
						const prefix = offsetLeft => `${offsetLeft !== undefined ? str16(offsetLeft) : '----'} ${'&nbsp;'.repeat(indent * 4)}`;
						if (block.opcode === undefined) {
							const parts = [];
							parts.push(`${prefix(block.offsetLeft)}${block.separators[0]}`);
							for (let i = 0; i < block.content.length - 1; ++i) {
								parts.push(...explore(block.content[i], indent + 1));
								parts.push(`${prefix(block.offsetsMiddle[i])}${block.separators[i + 1]}`);
							}
							parts.push(...explore(block.content[block.content.length - 1], indent + 1));
							parts.push(`${prefix(block.offsetRight)}${block.separators[block.separators.length - 1]}`);
							return parts;
						} else if (block.opcode === -2) {
							// raw string
							return `${prefix}${block.str}`;
						} else if (block.opcode === -1) {
							// raw data
							return `${prefix(block.offsetLeft)}${text(bytes(block.offsetLeft, block.offsetRight - block.offsetLeft, script))}</span>`;
						} else {
							// command
							const { opcode, returnTarget, args, offsetLeft, offsetRight } = block;
							return prefix(offsetLeft) + bai.command(script, opcode, returnTarget, args, offsetLeft, offsetRight, functionLabels);
						}
					}).flat();
					addHTML(preview, `<div style="color: var(--overlay2);"><code>${explore(tree, 0).join('<br>')}</code></div>`);
				}
			};
			updateScript();
		};
		update();

		return bai;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: FX Alls                                                                                              |
	// +---------------------------------------------------------------------------------------------------------------+

	const fxalls = (window.fxalls = createSection('FX Alls', (section) => {
		const fxalls = {};

		const files = ['/BRfx/BDfxAll.dat', '/BRfx/BDfxGAll.dat', '/BRfx/BOfxAll.dat', '/FRfx/FWfxAll.dat'];
		const fileSelect = dropdown(files, 0, () => updateFile());
		section.appendChild(fileSelect);

		let segmentSelect = dropdown([''], 0, () => {});
		section.appendChild(segmentSelect);

		const prettyPrint = checkbox('Pretty Print', true, () => updateSegment());
		section.appendChild(prettyPrint);

		const preview = document.createElement('div');
		section.appendChild(preview);

		let updateSegment = () => {};

		const updateFile = () => {
			const segments = unpackSegmented(fs.get(files[fileSelect.value]));
			const newDropdown = dropdown(segments.map((x, i) => `${i}. (len ${x.byteLength})`),
				0, () => updateSegment());
			segmentSelect.replaceWith(segmentSelect = newDropdown);

			updateSegment = () => {
				preview.innerHTML = '';
				const segment = segments[segmentSelect.value];

				const fxs = unpackSegmented16(segment);
				const ul = document.createElement('ul');
				for (let i = 0; i < fxs.length; ++i) {
					const u16 = bufToU16(fxs[i]);
					const s16 = bufToS16(fxs[i]);

					if (u16.length <= 1) {
						addHTML(ul, `<li><code>[${i}] ${bytes(0, fxs[i].byteLength, fxs[i])}</li>`);
						continue;
					}

					const parts = [];
					parts.push(`(totalLength ${u16[0]})`);

					let numKeyframes00;
					let numKeyframes24;
					let numKeyframes74;
					let numKeyframes80;
					let numKeyframes81;
					let o = 1;
					if (prettyPrint.checked) while (o < u16.length) {
						const composite = u16[o++];
						const cmd = composite & 0xff;
						const params = composite >> 8;

						if (cmd === 0x01) { // maybe
							parts.push(`(cx01<sub>${params}</sub> : ${s16[o++]})`);
						} else if (cmd === 0x02) { // maybe
							parts.push(`(cx02<sub>${params}</sub> : ${s16[o++]})`);
						} else if (cmd === 0x03) { // maybe
							parts.push(`(cx03<sub>${params}</sub> : ${s16[o++]})`);
						} else if (cmd === 0x04) { // maybe
							parts.push(`(cx04<sub>${params}</sub> : ${s16[o++]})`);
						} else if (cmd === 0x08) { // maybe
							parts.push(`(cx04<sub>${params}</sub> : ${s16[o++]})`);
						} else if (cmd === 0x19) { // pretty sure
							const nums = [];
							for (let i = 0; i < numKeyframes80; ++i) nums.push(s16[o++]);
							parts.push(`(x<sub>${params}</sub> : ${nums.join(' ')})`);
						} else if (cmd === 0x1a) { // pretty sure
							const nums = [];
							for (let i = 0; i < numKeyframes80; ++i) nums.push(s16[o++]);
							parts.push(`(y<sub>${params}</sub> : ${nums.join(' ')})`);
						} else if (cmd === 0x1b) { // pretty sure
							const nums = [];
							for (let i = 0; i < numKeyframes80; ++i) nums.push(s16[o++]);
							parts.push(`(z<sub>${params}</sub> : ${nums.join(' ')})`);
						} else if (cmd === 0x1c) { // pretty sure
							const nums = [];
							for (let i = 0; i < numKeyframes81; ++i) nums.push(s16[o++]);
							parts.push(`(red<sub>${params}</sub> : ${nums.join(' ')})`);
						} else if (cmd === 0x1d) { // pretty sure
							const nums = [];
							for (let i = 0; i < numKeyframes81; ++i) nums.push(s16[o++]);
							parts.push(`(green<sub>${params}</sub> : ${nums.join(' ')})`);
						} else if (cmd === 0x1d) { // pretty sure
							const nums = [];
							for (let i = 0; i < numKeyframes81; ++i) nums.push(s16[o++]);
							parts.push(`(blue<sub>${params}</sub> : ${nums.join(' ')})`);
						} else if (cmd === 0x24) { // pretty sure
							numKeyframes24 = (params + 2) / 2;
							const nums = [];
							for (let i = 0; i < numKeyframes24; ++i) nums.push(s16[o++]);
							parts.push(`(cx24 : ${nums.join(' ')})`);
						} else if (cmd === 0x34) { // maybe
							parts.push(`(cx34 : ${s16[o++]} ${s16[o++]})`);
						} else if (cmd === 0x35) { // maybe
							parts.push(`(cx35 : ${s16[o++]} ${s16[o++]})`);
						} else if (cmd === 0x36) { // maybe
							parts.push(`(cx36 : ${s16[o++]} ${s16[o++]})`);
						} else if (cmd === 0x37) { // maybe
							parts.push(`(cx37 : ${s16[o++]} ${s16[o++]})`);
						} else if (cmd === 0x74) { // pretty sure
							numKeyframes74 = (params + 2) / 2;
							const nums = [];
							for (let i = 0; i < numKeyframes74; ++i) nums.push(s16[o++]);
							parts.push(`(cx74 : ${nums.join(' ')})`);
						} else if (cmd === 0x80) { // pretty sure
							numKeyframes80 = (params + 2) / 2;
							const nums = [];
							for (let i = 0; i < numKeyframes80; ++i) nums.push(s16[o++]);
							parts.push(`(cx80 : ${nums.join(' ')})`);
						} else if (cmd === 0x81) { // pretty sure
							numKeyframes81 = (params + 2) / 2;
							const nums = [];
							for (let i = 0; i < numKeyframes81; ++i) nums.push(s16[o++]);
							parts.push(`(cx81 : ${nums.join(' ')})`);
						} else {
							o--; // unknown command, retry printing in the next loop
							break;
						}
					}

					for (; o < u16.length; ++o) {
						let style = '';
						if ((u16[o] >> 8) && (u16[o] < 0xf000)) style = 'style="color: #98f !important;"';
						parts.push(`<span ${style}>${str8(u16[o] & 0xff)} ${str8(u16[o] >> 8)}</span>`);
					}

					const colorized = parts.map((x,i) => i % 2 ? `<span style="color: var(--fg-dim);">${x}</span>` : x);
					addHTML(ul, `<li><code>[${i}] ${colorized.join(' ')}</code></li>`);
				}

				preview.appendChild(ul);
			};
			updateSegment();
		};
		updateFile();

		return fxalls;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: FX Sprites                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	const fxsprites = (window.fxsprites = createSection('FX Sprites', (section) => {
		const fxsprites = {};

		const files = [
			{ label: 'BDfx', pals: fsext.bdfxpal?.segments, texs: fsext.bdfxtex?.segments },
			{ label: 'BLfx', pals: undefined, texs: fsext.blfxtex?.segments },
			{ label: 'BOfx', pals: fsext.bofxpal?.segments, texs: fsext.bofxtex?.segments },
			{ label: 'FDfx', pals: fsext.fdfxpal?.segments, texs: fsext.fdfxtex?.segments },
			{ label: 'FOfx', pals: fsext.fofxpal?.segments, texs: fsext.fofxtex?.segments },
			{ label: 'MDfx', pals: unpackSegmented(fs.get('/MRfx/MDfxPal.dat')),
				texs: unpackSegmented(fs.get('/MRfx/MDfxTex.dat')) },
			{ label: 'MOfx', pals: unpackSegmented(fs.get('/MRfx/MOfxPal.dat')),
				texs: unpackSegmented(fs.get('/MRfx/MOfxTex.dat')) },
		];
		const fileSelect = dropdown(files.map(x => x.label), 0, () => updateFile());
		section.appendChild(fileSelect);

		let segmentSelect = dropdown([''], 0, () => {});
		section.appendChild(segmentSelect);

		const scaleSelect = dropdown(['Scale: 1x', 'Scale: 2x', 'Scale: 3x', 'Scale: 4x'], 0, () => updateTexture());
		section.appendChild(scaleSelect);

		const paletteRowOptions = [];
		for (let i = 0; i < 16; ++i) paletteRowOptions.push(`Pal Row: 0x${i.toString(16)}`);
		const paletteRowSelect = dropdown(paletteRowOptions, 0, () => updateTexture());
		section.appendChild(paletteRowSelect);

		const forceFallbackPalette = checkbox('Force Fallback Palette', false, () => updateTexture());
		section.appendChild(forceFallbackPalette);

		const metaTop = document.createElement('div');
		section.appendChild(metaTop);

		const preview = document.createElement('div');
		preview.style.cssText = 'position: relative; height: calc(20px + 128px);';
		section.appendChild(preview);

		const paletteCanvas = document.createElement('canvas');
		const paletteCtx = paletteCanvas.getContext('2d');
		paletteCanvas.style.cssText = `position: absolute; top: 0; left: 0; height: 128px; width: 128px;`;
		paletteCanvas.width = 16;
		paletteCanvas.height = 16;
		preview.appendChild(paletteCanvas);

		const textureCanvas = document.createElement('canvas');
		const textureCtx = textureCanvas.getContext('2d');
		textureCanvas.style.cssText = `position: absolute; top: 0; left: 128px; height: 256px; width: 192px;`;
		textureCanvas.width = 256;
		textureCanvas.height = 192;
		preview.appendChild(textureCanvas);

		const meta = document.createElement('div');
		section.appendChild(meta);

		const fallbackPaletteU16 = new Uint16Array(256);
		for (let row = 0; row < 16; ++row) {
			fallbackPaletteU16.set([
				0,
				31 | 0 << 5 | row << 11,
				31 | 8 << 5 | row << 11,
				31 | 16 << 5 | row << 11,
				31 | 24 << 5 | row << 11,
				31 | 31 << 5 | row << 11,
				row << 1 | 31 << 5 | 0 << 10,
				row << 1 | 31 << 5 | 8 << 10,
				row << 1 | 31 << 5 | 16 << 10,
				row << 1 | 31 << 5 | 24 << 10,
				row << 1 | 31 << 5 | 31 << 10,
				0 | row << 6 | 31 << 10,
				8 | row << 6 | 31 << 10,
				16 | row << 6 | 31 << 10,
				24 | row << 6 | 31 << 10,
				31 | row << 6 | 31 << 10,
			], row * 16);
		}
		const fallbackPaletteU32 = rgb15To32(fallbackPaletteU16);

		let updateSegment = () => {};
		let updateTexture = () => {};

		const updateFile = () => {
			const { label, pals, texs } = files[fileSelect.value];
			if (!pals?.length && !texs?.length) {
				meta.innerHTML = '';
				preview.style.display = 'none';
				metaTop.innerHTML = `No palette offsets or texture offsets available`;
				segmentSelect.style.display = 'none';
				updateSegment = () => {};
				updateTexture = () => {};
				return;
			}

			// textures are required, palettes are optional
			const palettesById = new Map();
			if (pals) {
				for (let i = 0; i < pals.length; ++i) {
					if (pals[i].byteLength !== 516) continue;
					palettesById.set(pals[i].getUint32(0, true), sliceDataView(pals[i], 4, 516));
				}
			}

			const options = [];
			for (let i = 0; i < texs.length; ++i) {
				if (texs[i].byteLength < 8) continue;
				options.push([`Texture 0x${i.toString(16)}`, i]);
			}
			segmentSelect.replaceWith(segmentSelect = dropdown(options.map(x => x[0]), 0, () => updateSegment()));

			updateSegment = () => {
				metaTop.innerHTML = '';
				meta.innerHTML = '';
				const id = options[segmentSelect.value][1];

				// the compressed textures can expand to 0 bytes
				const texCompressed = texs[id];
				const tex = texCompressed.byteLength ? lzBis(texCompressed) : undefined;
				if (!tex?.byteLength) {
					addHTML(metaTop, `Texture 0x${id.toString(16)} is empty`);
					preview.style.display = 'none';
					updateTexture = () => {};
					return;
				}
				preview.style.display = '';

				const width = tex.getUint8(0);
				const height = tex.getUint8(1);
				const bitDepth = tex.getUint8(2);
				const unknown = tex.getUint8(3);
				const paletteId = tex.getUint32(4, true);
				addHTML(metaTop, `<div>${width}x${height} / ${bitDepth}bpp / pal 0x${paletteId.toString(16)}</div>`);

				const fallbackPaletteWarning = document.createElement('div');
				fallbackPaletteWarning.style.cssText = 'color: var(--red); display: none';
				fallbackPaletteWarning.textContent = 'Palette not found, using fallback palette';
				metaTop.appendChild(fallbackPaletteWarning);

				updateTexture = () => {
					let palU32;
					if (forceFallbackPalette.checked) {
						palU32 = fallbackPaletteU32;
					} else {
						const palDat = palettesById.get(paletteId);
						if (palDat) {
							fallbackPaletteWarning.style.display = 'none';
							palU32 = rgb15To32(bufToU16(palDat));
						} else {
							fallbackPaletteWarning.style.display = '';
							palU32 = fallbackPaletteU32;
						}
					}

					paletteCtx.putImageData(new ImageData(bufToU8Clamped(palU32), 16, 16), 0, 0);

					const scale = [1, 2, 3, 4][scaleSelect.value];
					textureCanvas.width = width * 8;
					textureCanvas.height = height * 8;
					textureCanvas.style.width = `${width * 8 * scale}px`;
					textureCanvas.style.height = `${height * 8 * scale}px`;
					preview.style.height = `${Math.max(height * 8 * scale, 128) + 20}px`;
					
					const paletteOffset = paletteRowSelect.value << 4;
					const bitmapU32 = new Uint32Array(width * height * 64);
					let o = 8;
					const texU8 = bufToU8(tex);
					for (let tileY = 0; tileY < height; ++tileY) {
						for (let tileX = 0; tileX < width; ++tileX) {
							const basePos = (tileY * 8 * width * 8) + tileX * 8;
							if (bitDepth === 4) {
								for (let i = 0; i < 32; ++i) {
									const pos = basePos + (i >> 2) * width * 8 + ((i & 3) << 1);
									const composite = texU8[o++];
									bitmapU32[pos] = palU32[(composite & 0xf) + paletteOffset] ?? 0;
									bitmapU32[pos ^ 1] = palU32[(composite >> 4) + paletteOffset] ?? 0;
								}
							} else if (bitDepth === 8) {
								for (let i = 0; i < 64; ++i) {
									const pos = basePos + (i >> 3) * width * 8 + (i & 7);
									bitmapU32[pos] = palU32[texU8[o++] + paletteOffset] ?? 0;
								}
							}
						}
					}

					textureCtx.putImageData(new ImageData(bufToU8Clamped(bitmapU32), width * 8, height * 8), 0, 0);
				};
				updateTexture();
			};
			updateSegment();
		};
		updateFile();

		return fxalls;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Disassembler                                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initDisassembler) await waitFor(() => window.initDisassembler);
	window.initDisassembler();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: VTable Scanner                                                                                       |
	// +---------------------------------------------------------------------------------------------------------------+

	const vtables = (window.vtables = createSection('VTables', (section) => {
		const vtables = {};

		const picked = new Set();

		const overlapDisplay = document.createElement('div');
		overlapDisplay.style.cssText = `height: 20px; width: 100%; background: var(--surface0); position: relative;`;
		section.appendChild(overlapDisplay);

		const scanStatus = document.createElement('div');
		scanStatus.textContent = '0 overlays selected';
		section.appendChild(scanStatus);

		const overlapping = new Set();
		const highlightOverlap = () => {
			overlapping.clear();

			for (const ov1 of picked) {
				for (const ov2 of picked) {
					if (ov1.id >= ov2.id) continue;
					if (ov1.ramStart < ov2.ramStart + ov2.ramSize && ov2.ramStart < ov1.ramStart + ov1.ramSize) {
						overlapping.add(ov1);
						overlapping.add(ov2);
					}
				}
			}

			for (const ov of picked) {
				const bad = overlapping.has(ov);
				ov.overlapBox.style.background = bad ? '#ff84a833' : 'var(--surface1)';
				ov.overlapBox.style.borderColor = bad ? 'var(--red)' : 'var(--overlay2)';
			}

			if (overlapping.size) {
				scanStatus.style.color = 'var(--red)';
				scanStatus.textContent = `${overlapping.size} overlapping: ${[...overlapping].map(x => x.name).join(', ')}`;
			} else {
				scanStatus.style.color = '';
				scanStatus.textContent = `No overlaps, ${picked.size} picked`;
			}
		};

		const addEntry = (name, id, bufProvider, ramStart, ramSize) => {
			const overlapBox = document.createElement('div');
			overlapBox.style.cssText = `position: absolute; top: 0; left: ${(ramStart - 0x02000000) / 0x400000 * 100}%;
				width: ${ramSize / 0x400000 * 100}%; height: 20px; background: var(--surface1); border: 1px solid var(--overlay2); display: none; z-index: 2; opacity: 0.333;`;
			overlapDisplay.appendChild(overlapBox);

			const container = { overlapBox, name, id, bufProvider, ramStart, ramSize };

			const check = checkbox(name, false, checked => {
				overlapBox.style.opacity = checked ? '1' : '0.333';
				overlapBox.style.zIndex = checked ? '0' : '2';

				if (checked) picked.add(container);
				else {
					picked.delete(container);
					overlapBox.style.background = 'var(--surface1)';
					overlapBox.style.borderColor = 'var(--overlay2)';
				}

				highlightOverlap();
			});
			section.appendChild(check);

			check.addEventListener('mouseover', () => {
				if (check.checked) return;
				overlapBox.style.display = '';
			});
			check.addEventListener('mouseout', () => {
				if (check.checked) return;
				overlapBox.style.display = 'none';
			});
		};
		addEntry('ARM9&nbsp;', -2, () => fs.arm9, headers.arm9ram, fs.arm9.byteLength);
		addEntry('ARM7&nbsp;', -1, () => fs.arm7, headers.arm7ram, fs.arm7.byteLength);
		for (const ov of ovt.overlays) {
			addEntry(`ov${String(ov.id).padStart(3, '0')}`, ov.id, () => fs.overlay(ov.id, true), ov.ramStart, ov.ramSize);
		}

		section.appendChild(button('Scan', () => {
			scanPreview.innerHTML = '';

			// MLBIS's RTTI info seems to follow this structure:
			// https://itanium-cxx-abi.github.io/cxx-abi/abi.html#rtti
			// - MLBIS only uses abi::__class_type_info, abi::__si_class_type_info, and abi::__vmi_class_type_info, not
			//   the other derived types of std::type_info
			// - Mangled names do not start with "_Z"

			const errors = [];
			const checkErrors = () => {
				if (!errors.length) return;

				addHTML(scanPreview, `Errors: <ul>${errors.map(x => '<li>' + x + '</li>').join('')}</ul>`);
				for (let i = 0; i < errors.length - 1; ++i) console.error(errors[i]);
				throw errors[errors.length - 1];
			};

			// #1 : copy all overlays into a temporary buffer (it's "rebased")
			const dat = new DataView(new ArrayBuffer(0x400000));
			const u8 = bufToU8(dat);
			const s32 = bufToS32(dat);
			for (const ov of picked) {
				bufToS32(dat).set(bufToS32(ov.bufProvider()), (ov.ramStart - 0x02000000) / 4);
			}

			// #2 : search for mangled names, and demangle them
			const offsetToDemangled = new Map();
			const demangledToOffsets = new Map();
			let lastInvalid = -1;
			for (let o = 0; o < 0x400000; ++o) {
				const byte = u8[o];
				if ((0x41 <= byte && byte <= 0x5a)/* A-Z */ || (0x61 <= byte && byte <= 0x7a)/* a-z */
					|| (0x30 <= byte && byte <= 0x39)/* 0-9 */ || byte === 0x5f/* _ */) continue;

				const start = lastInvalid + 1;
				const end = o;
				lastInvalid = o;

				const length = end - start;
				if (length < 4) continue; // classes can be as short as "clFS"
				if (byte !== 0) continue; // string must be null-terminated

				// these are examples of mangled names:
				// - 10clYanaAnim, 5clPaf, St9type_info, 10inYanaUnit
				// - N8nsObjSys11clCellAnimeE, N10__cxxabiv117__class_type_infoE
				// note the "cl", "ns", and "in" prefixes are part of the original names, in fact, the developers break
				// the convention with "N11clBtlObjCsr15clBtlObjCsrCopyE"

				let o2 = start;
				const readUnqualifiedName = () => {
					let len = 0;
					for (let i = 0; i < 3 && o2 < end; ++i, ++o2) {
						if (!(0x30 <= u8[o2] && u8[o2] <= 0x39)/* 0-9 */) break;
						len *= 10;
						len += u8[o2] - 0x30;
					}

					if (len > end - o2) return undefined;
					const str = latin1(o2, len, dat);
					o2 += len;
					return str;
				};

				const readUnscopedName = () => {
					let prefix = '';
					if (u8[o2] === 0x53 /* S */ && u8[o2 + 1] === 0x74 /* t */) {
						prefix = 'std::';
						o2 += 2;
					}

					return prefix + readUnqualifiedName();
				};

				// readName
				let demangled;
				if (u8[o2] === 0x4e /* N */) {
					// namespace
					++o2;
					// assume no CV-qualifiers or ref-qualifiers
					const prefix = readUnqualifiedName();
					const name = readUnqualifiedName();
					if (!prefix || !name) continue;

					if (u8[o2++] !== 0x45 /* E */) continue;
					if (o2 !== end || u8[o2] !== 0) continue;

					demangled = prefix + '::' + name;
				} else {
					demangled = readUnscopedName();
					if (o2 !== end || u8[o2] !== 0) continue;
				}

				const offsets = demangledToOffsets.get(demangled);
				if (offsets) offsets.push(start);
				else demangledToOffsets.set(demangled, [start]);

				offsetToDemangled.set(start, demangled);
			}

			// #3 : find pointers to those strings
			const demangledToReferences = new Map();
			for (let o = 0; o < 0x400000; o += 4) {
				const value = dat.getUint32(o, true);
				// rule out mostly anything that isn't a pointer
				if (!(0x02000000 <= value && value < 0x02400000)) continue;

				const demangled = offsetToDemangled.get(value - 0x02000000);
				if (!demangled) continue;

				// value is a const char* pointing to this mangled string
				// but it might not be a type_info struct ("clTask" has the unfortunately simple address 02050000)
				// so, assuming this would be a type_info struct, ensure the above u32 points to some vtable
				const previousValue = dat.getUint32(o - 4, true);
				if (!(0x02000000 <= previousValue && previousValue <= 0x02400000)) continue;
				const potentialVtableFirstFunction = dat.getUint32(previousValue - 0x02000000, true);
				if (!(0x02000000 <= potentialVtableFirstFunction && potentialVtableFirstFunction <= 0x02400000))
					continue;

				// this is probably a real reference
				const refs = demangledToReferences.get(demangled);
				if (refs) refs.push({ from: o, to: value - 0x02000000 });
				else demangledToReferences.set(demangled, [{ from: o, to: value - 0x02000000 }]);
			}

			// #4 : validate that the name references are 1-1
			for (const [demangled, offsets] of demangledToOffsets) {
				const refs = demangledToReferences.get(demangled);
				if (refs?.length !== offsets.length) {
					errors.push(`${demangled} is defined at ${offsets.length} places ` +
						`(${offsets.map(x => str32(x + 0x02000000)).join(', ')}) but referenced at ` +
						`${refs?.length ?? 0} places instead ` +
						`${refs ? '(' + refs.map(x => str32(x.from + 0x02000000)).join(', ')  + ')' : ''}`);
					continue;
				}

				const usedOffsets = new Set();
				for (const { from, to } of refs) {
					if (usedOffsets.has(to)) {
						errors.push(`${demangled} @ ${str32(from + 0x02000000)} is referenced more than once, ` +
							`references: ${refs.filter(ref => ref.to === to).map(x => str32(x.from + 0x02000000)).join(', ')}`);
					}

					usedOffsets.add(to);
				}
			}
			checkErrors();

			// #5 : from the name references, build out type_info-derived structs
			const demangledToTypeInfos = new Map();
			const offsetToTypeInfo = new Map();
			for (const [demangled, refs] of demangledToReferences) {
				const typeInfos = [];
				demangledToTypeInfos.set(demangled, typeInfos);
				for (const ref of refs) {
					// this is also the reference to the implied vtable of the base class
					// (__class_type_info, __si_class_type_info, __vmi_class_type_info)
					const typeInfoOffset = ref.from - 4;
					// TODO: validate these pointers on the way
					const baseVtablePtr = dat.getUint32(typeInfoOffset, true) - 0x02000000;
					const baseTypeInfoOffset = dat.getUint32(baseVtablePtr - 4, true) - 0x02000000;
					const baseTypeInfoNamePtr = dat.getUint32(baseTypeInfoOffset + 4, true) - 0x02000000;
					const baseTypeInfoName = offsetToDemangled.get(baseTypeInfoNamePtr);

					let typeInfo;
					if (baseTypeInfoName === '__cxxabiv1::__class_type_info') {
						// no base class
						typeInfo = {
							offset: typeInfoOffset,
							name: demangled,
							type: baseTypeInfoName,
							baseTypeInfoOffsets: [],
							dat: sliceDataView(dat, typeInfoOffset, typeInfoOffset + 8),
						};
					} else if (baseTypeInfoName === '__cxxabiv1::__si_class_type_info') {
						// single, public, non-virtual base class
						typeInfo = {
							offset: typeInfoOffset,
							name: demangled,
							type: baseTypeInfoName,
							baseTypeInfoOffsets: [{
								at: dat.getUint32(typeInfoOffset + 8, true) - 0x02000000,
								vptrFieldOffset: 0,
								virtual: false,
								public: true,
							}],
							dat: sliceDataView(dat, typeInfoOffset, typeInfoOffset + 12),
						};
					} else if (baseTypeInfoName === '__cxxabiv1::__vmi_class_type_info') {
						const classFlags = dat.getUint32(typeInfoOffset + 8, true);
						const baseCount = dat.getUint32(typeInfoOffset + 12, true);
						const baseTypeInfoOffsets = [];
						for (let i = 0, o = typeInfoOffset + 16; i < baseCount; ++i, o += 8) {
							const baseTypeInfoOffset = dat.getUint32(o, true) - 0x02000000;
							const offsetFlags = dat.getInt32(o + 4, true);
							baseTypeInfoOffsets.push({
								at: baseTypeInfoOffset,
								vptrFieldOffset: Math.abs(offsetFlags >> 8),
								virtual: !!(offsetFlags & 1),
								public: !!(offsetFlags & 2),
							});
						}

						typeInfo = {
							offset: typeInfoOffset,
							name: demangled,
							type: baseTypeInfoName,
							baseTypeInfoOffsets,
							dat: sliceDataView(dat, typeInfoOffset, typeInfoOffset + 16 + baseCount * 8),
						};
					} else {
						errors.push(`${demangled}'s type_info struct @ ${str32(typeInfoOffset + 0x02000000)} inherits `+
							`from unhandled type_info derivative ${baseTypeInfoName}`);
						continue;
					}

					typeInfos.push(typeInfo);
					offsetToTypeInfo.set(typeInfoOffset, typeInfo);
				}
			}
			checkErrors();

			// #6 : make sure that the duplicate type_infos found exactly match
			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				if (typeInfos.length < 2) continue;
				const u8First = bufToU32(typeInfos[0].dat);

				for (let i = 1; i < typeInfos.length; ++i) {
					const u8Second = bufToU32(typeInfos[i].dat);

					let equivalent = u8First.length === u8Second.length;
					for (let o = 0; o < u8First.length && equivalent; ++o) {
						equivalent ||= u8First[o] === u8Second[o];
					}

					if (equivalent) continue; // ok
					errors.push(`${demangled} has duplicate type_infos that aren't equivalent @ ` +
						`${str32(typeInfos[0].offset + 0x02000000)} and ${str32(typeInfos[i].offset + 0x02000000)}`);
				}
			}
			checkErrors();

			// #7 : make sure that type_infos reference real base type_infos
			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				const typeInfo = typeInfos[0];
				for (const baseTypeInfoOffset of typeInfo.baseTypeInfoOffsets) { 
					if (offsetToTypeInfo.has(baseTypeInfoOffset.at)) continue;

					errors.push(`${demangled}'s type_info @ ${str32(typeInfo.offset + 0x02000000)} references a base ` +
						`type_info @ ${str32(baseTypeInfoOffset.at + 0x02000000)}, but it doesn't exist`);
				}
			}
			checkErrors();

			// #8 : find the vtables associated with each class's type_info
			const typeInfoToVtablePtrs = new Map();
			for (let o = 0; o < 0x400000; o += 4) {
				const value = dat.getUint32(o, true);
				if (!(0x02000000 <= value && value <= 0x02400000)) continue;

				const typeInfo = offsetToTypeInfo.get(value - 0x02000000);
				if (!typeInfo) continue;

				const vtableOffset = o + 4;

				// make sure this really is a vtable, by checking that at least the first member is also a pointer
				const firstVtableMember = dat.getUint32(vtableOffset, true);
				if (!(0x02000000 <= firstVtableMember && firstVtableMember <= 0x02400000)) continue;

				// also check that vptrFieldOffset is not absurdly huge
				const vptrFieldOffset = -dat.getInt32(o - 4, true);
				if (!(-65536 <= vptrFieldOffset && vptrFieldOffset <= 65536)) continue;

				console.log(`found vtable for ${typeInfo.name} at ${str32(vtableOffset + 0x02000000)}`);

				if (typeInfo.type === '__cxxabiv1::__class_type_info') {
					// no base class, but this class still has a vtable
					const previousVtablePtrs = typeInfoToVtablePtrs.get(typeInfo);
					if (previousVtablePtrs) {
						const [prevVptrFieldOffset, at] = previousVtablePtrs.entries().next().value;
						errors.push(`Base class ${typeInfo.name}'s type_info @ ` +
							`${str32(typeInfo.offset + 0x02000000)} already has an associated vtable at ` +
							`${str32(at + 0x02000000)} (vptr at field_0x${prevVptrFieldOffset.toString(16)}), ` +
							`but a new one was found at ${str32(vtableOffset + 0x02000000)} (vptr at ` +
							`field_0x${vptrFieldOffset.toString(16)})`);
						continue;
					}

					typeInfoToVtablePtrs.set(typeInfo, new Map([[vptrFieldOffset, [vtableOffset]]]));
				} else {
					const vtablePtrs = typeInfoToVtablePtrs.get(typeInfo);
					if (vtablePtrs) {
						// make sure this vptr field hasn't already been assigned a vtable
						const prevVtablePtrs = vtablePtrs.get(vptrFieldOffset);
						if (prevVtablePtrs) prevVtablePtrs.push(vtableOffset);
						else vtablePtrs.set(vptrFieldOffset, [vtableOffset]);
					} else {
						typeInfoToVtablePtrs.set(typeInfo, new Map([[vptrFieldOffset, [vtableOffset]]]));
					}
				}
			}
			checkErrors();

			// #9 : propagate public/virtual info about base classes from a type_info to its base's type_info
			const typeInfoToClassAttr = new Map();
			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				for (const baseTypeInfoOffset of typeInfos[0].baseTypeInfoOffsets) {
					const baseTypeInfo = offsetToTypeInfo.get(baseTypeInfoOffset.at); // must be valid, by #7
					const previousAttr = typeInfoToClassAttr.get(baseTypeInfo);
					if (previousAttr) {
						// make sure the info is not mismatched (a base class can't be public/virtual in one place but
						// not in another)
						if (previousAttr.public === baseTypeInfoOffset.public
							|| previousAttr.virtual === baseTypeInfoOffset.virtual) continue;

						errors.push(`${demangled}'s type_info @ ${str32(typeInfos[0].offset + 0x02000000)} ` +
							`marks base class ${baseTypeInfo.name} as public=${baseTypeInfoOffset.public} & ` +
							`virtual=${baseTypeInfoOffset.virtual}, but it was previously marked as ` +
							`public=${previousAttr.public} & virtual=${previousAttr.virtual} by ` +
							`${previousAttr.blame}`);
					} else {
						typeInfoToClassAttr.set(baseTypeInfo, {
							public: baseTypeInfoOffset.public,
							virtual: baseTypeInfoOffset.virtual,
							blame: `${demangled} (type_info @ ${str32(typeInfos[0].offset + 0x02000000)})`,
						});
					}
				}
			}

			// #10 : display info
			const table = document.createElement('table');
			table.className = 'bordered';
			addHTML(table, `<tr>
				<th>Name</th>
				<th>Base Classes</th>
				<th>VTables</th>
				<th>type_infos</th>
			</tr>`);

			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				const typeInfo = typeInfos[0];
				const classAttr = typeInfoToClassAttr.get(typeInfo);

				let nameField = demangled;
				if (classAttr) {
					if (classAttr.virtual && !classAttr.public) nameField += '<br>(virtual, private)';
					else if (classAttr.virtual) nameField += '<br>(virtual)';
					else if (!classAttr.public) nameField += '<br>(private)';
				} else {
					nameField += '<br>(no known subclasses)';
				}

				const baseClassesField = [...typeInfo.baseTypeInfoOffsets]
					.sort((a,b) => a.vptrFieldOffset - b.vptrFieldOffset)
					// must be valid, by #7
					.map(x => `field_0x${x.vptrFieldOffset.toString(16)} - ${offsetToTypeInfo.get(x.at).name}`)
					.join('<br>');

				const vtablePtrs = [];
				for (const otherTypeInfo of typeInfos) {
					const thisVtablePtrs = typeInfoToVtablePtrs.get(otherTypeInfo);
					if (thisVtablePtrs) vtablePtrs.push(...thisVtablePtrs);
				}

				let vtablesField = '';
				if (vtablePtrs.length) {
					vtablesField = vtablePtrs.sort((a,b) => a[0] - b[0])
						.map(([vptrFieldOffset, vtableOffsets]) => {
							const prefix = `field_0x${vptrFieldOffset.toString(16)} - `;
							return vtableOffsets.map((y, i) => {
								if (!i) return prefix + str32(y + 0x02000000);
								else return '&nbsp;'.repeat(prefix.length) + str32(y + 0x02000000);
							}).join('<br>')
						})
						.join('<br>');
				}

				const typeInfosField = typeInfos.map(x => str32(x.offset + 0x02000000)).join('<br>');

				addHTML(table, `<tr style="font-family: 'Red Hat Mono'; text-align: center;">
					<td>${nameField || '-'}</td>
					<td>${baseClassesField || '-'}</td>
					<td>${vtablesField || '-'}</td>
					<td>${typeInfosField}</td>
				</tr>`);
			}
			scanPreview.appendChild(table);
		}));

		const scanPreview = document.createElement('div');
		section.appendChild(scanPreview);

		return vtables;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Sound Data (very unfinished)                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	const sound = (window.sound = createSection('Sound (very unfinished)', (section) => {
		const sound = {};

		const soundFile = fs.get('/Sound/sound_data.sdat');

		const symbStart = soundFile.getUint32(0x10, true);
		const symbLength = soundFile.getUint32(0x14, true);
		const symbDat = (sound.symbDat = sliceDataView(soundFile, symbStart, symbStart + symbLength));

		const infoStart = soundFile.getUint32(0x18, true);
		const infoLength = soundFile.getUint32(0x1c, true);
		const infoDat = (sound.infoDat = sliceDataView(soundFile, infoStart, infoStart + infoLength));

		const fatStart = soundFile.getUint32(0x20, true);
		const fatLength = soundFile.getUint32(0x24, true);
		const fatDat = (sound.fatDat = sliceDataView(soundFile, fatStart, fatStart + fatLength));

		const fileStart = soundFile.getUint32(0x28, true);
		const fileLength = soundFile.getUint32(0x2c, true);
		const fileDat = (sound.fileDat = sliceDataView(soundFile, fileStart, fileStart + fileLength));

		window.infoDat = infoDat;
		window.symbDat = symbDat;
		window.fatDat = fatDat;
		window.fileDat = fileDat;

		// symb block
		const symbFileList = (o) => {
			const length = symbDat.getUint32(o, true);
			const files = [];
			for (let i = 0; i < length; ++i) files.push(latin1(symbDat.getUint32(o + i * 4, true), undefined, symbDat));
			return files;
		};
		const symbFolderList = (o) => {
			const length = symbDat.getUint32(o, true);
			const folders = [];
			for (let i = 0; i < length; ++i) {
				const name = latin1(symbDat.getUint32(o + 4 + i * 8, true), undefined, symbDat);
				const files = symbFileList(symbDat.getUint32(o + 8 + i * 8, true));
				folders.push([name, files]);
			}
			return folders;
		};
		const symb = {};
		symb.sseq = symbFileList(symbDat.getUint32(8, true));
		symb.ssar = symbFolderList(symbDat.getUint32(12, true));
		symb.bank = symbFileList(symbDat.getUint32(16, true));
		symb.swar = symbFileList(symbDat.getUint32(20, true));
		symb.player = symbFileList(symbDat.getUint32(24, true));
		symb.group = symbFileList(symbDat.getUint32(28, true));
		symb.player2 = symbFileList(symbDat.getUint32(32, true));
		symb.strm = symbFileList(symbDat.getUint32(36, true));

		// LET"S try this again
		sound.names = [];
		const symbSseqOffset = symbDat.byteLength ? symbDat.getUint32(8, true) : 0;
		const infoSseqOffset = infoDat.getUint32(8, true);
		const infoSseqLength = infoDat.getUint32(infoSseqOffset, true);
		for (let i = 0; i < infoSseqLength; ++i) {
			const offset = infoDat.getUint32(infoSseqOffset + 4 + i * 4, true);
			const segment = sliceDataView(infoDat, offset, offset + 12);
			const fatId = segment.getUint16(0, true);
			const bank = segment.getUint16(4, true);
			const volume = segment.getUint8(6);
			const cpr = segment.getUint8(7);
			const ppr = segment.getUint8(8);
			const ply = segment.getUint8(9);

			let name = '';
			if (symbDat.byteLength) {
				const nameOffset = symbDat.getUint32(symbSseqOffset + 4 + i * 4, true);
				name = latin1(nameOffset, undefined, symbDat);
			}

			sound.names[i] = name;
			let html = `sseq[${i}] : ${name} (fatId ${fatId}) (bank ${bank}) (volume ${volume}) (cpr ${cpr}) (ppr ${ppr}) (ply ${ply});`;
			if (12 + fatId * 16 + 8 <= fatDat.byteLength) {
				const fileStart = fatDat.getUint32(12 + fatId * 16, true);
				const fileSize = fatDat.getUint32(12 + fatId * 16 + 4, true);
				html += ` (fileStart 0x${str32(fileStart)}) (fileSize 0x${fileSize.toString(16)})`;
			}
			addHTML(section, `<div><code>${html}</code></div>`);
		}

		return sound;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Object Palette Animations (very unfinished)                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const objpalanim = (window.objpalanim = createSection('Object Palette Animations (very unfinished)', (section) => {
		const objpalanim = {};

		const fileSelect = dropdown(['FObj'], 0, () => updateFile());
		section.appendChild(fileSelect);

		const table = document.createElement('table');
		table.style.cssText = 'border-collapse: collapse;';
		section.appendChild(table);

		const updateFile = () => {
			let paletteTable, segmentsTable;
			if (fileSelect.value === 0) paletteTable = fsext.fobjPalettes, segmentsTable = fsext.fobj;

			if (!paletteTable) {
				table.innerHTML = '<tr><td>This entry doesn\'t exist in fpaf</td></tr>';
				return;
			}

			table.innerHTML = '';
			for (let i = 0; i < paletteTable.length; ++i) {
				const palAnimIndex = paletteTable[i].getInt16(2, true);
				if (palAnimIndex === -1) continue;

				const bigSeg = fsext.fobj.segments[palAnimIndex];
				let segments;
				try {
					segments = unpackSegmented16(bigSeg);
				} catch (err) {
					addHTML(table, `<tr style="border-bottom: 1px solid var(--line);">
						<td><code>${i}</code></td>
						<td style="padding: 10px 0;"><code>${bytes(0, bigSeg.byteLength, bigSeg)}</code></td>
					</tr>`);
					continue;
				}

				const items = [`<li><code>${bytes(0, segments[0].byteLength, segments[0])}</code></li>`];
				for (let i = 1; i < segments.length - 1; ++i) {
					try {
						items.push(`<li><code>${fpaf.stringify([segments[i]]).join('<br>')}</code></li>`);
					} catch (err) {
						items.push(`<li><code>${bytes(0, segments[i].byteLength, segments[i])}</code></li>`);
					}
				}

				addHTML(
					table,
					`<tr style="border-bottom: 1px solid var(--line);">
						<td><code>${i} (s${palAnimIndex})</code></td>
						<td style="padding: 10px 0;"><ul>${items.join('')}</ul></td>
					</tr>`,
				);
			}
		};
		updateFile();

		return objpalanim;
	}));

	// add spacing to the bottom of the page, for better scrolling
	addHTML(document.body, '<div style="height: 100vh;"></div>');

	// devtools console help
	const loadingEnd = performance.now();
	console.log(`File read in ${sectionLoadingStart - fileLoadingStart} ms; loaded in ${loadingEnd - sectionLoadingStart} ms`);

	console.log(
		`Dumping functions: \
	\n%clatin1(off, len, dat) \nbytes(off, len, dat) \nbits(off, len, dat) \
	\ndownload(name, dat, mime = 'application/octet-stream') %c \
	\n\nCompression/Packing functions: \
	\n%cblz(indat) \nblzCompress(indat, minimumSize?) \nlzBis(indat) \nlzBisCompress(indat, blockSize = 512) \
	\nzipStore(files) \nunpackSegmented(dat) %c \
	\n\nView functions: \
	\n%csliceDataView(dat, start, end) \nbufToU8(buf) \nbufToU8Clamped(buf) \nbufToU16(buf) \nbufToS16(buf) \
	\nbufToU32(buf) \nbufToDat(buf) \nstr8(x) \nstr16(x) \nstr32(x) %c \
	\n\nSections: \
	\n%cheaders fs fsext field fmapdataTiles battle battleGiant fx mfset mes disassembler sound %c \
	\n\nFile: %cfile%c`,
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
	);
})();
