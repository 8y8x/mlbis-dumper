'use strict';

window.initFonts = () => {
	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Fonts                                                                                                |
	// +---------------------------------------------------------------------------------------------------------------+

	const fonts = (window.fonts = createSection('Fonts', section => {
		const fonts = {};

		fonts.languageNamesWithFonts = (c => {
			c[0] = 'JP/KO replacements';
			c[1] = 'JP/KO small';
			c[2] = 'JP/KO small replacements';
			c[3] = 'JP/KO big';
			c[4] = 'JP/KO big replacements';
			c[5] = 'English (?)';
			c[6] = 'English small';
			c[7] = 'English (?)';
			c[8] = 'English big';
			c[9] = 'English (?)';
			c[10] = 'French (?)';
			c[11] = 'French small';
			c[12] = 'French (?)';
			c[13] = 'French big';
			c[14] = 'French (?)';
			c[15] = 'German (?)';
			c[16] = 'German small';
			c[17] = 'German (?)';
			c[18] = 'German big';
			c[19] = 'German (?)';
			c[20] = 'Italian (?)';
			c[21] = 'Italian small';
			c[22] = 'Italian (?)';
			c[23] = 'Italian big';
			c[24] = 'Italian (?)';
			c[25] = 'Spanish (?)';
			c[26] = 'Spanish small';
			c[27] = 'Spanish (?)';
			c[28] = 'Spanish big';
			c[29] = 'Spanish (?)';

			c[66] = 'JP/KO';
			c[67] = 'English';
			c[68] = 'French';
			c[69] = 'German';
			c[70] = 'Italian';
			c[71] = 'Spanish';
			return c;
		})([]);

		fonts.languageNames = (c => {
			c[0] = 'JP/KO';
			c[1] = 'English';
			c[2] = 'French';
			c[3] = 'German';
			c[4] = 'Italian';
			c[5] = 'Spanish';
			return c;
		})([]);

		// unmappable: 0x00 | 0x05-0x08 | 0x0c-0x1f | 0x40 | 0x60 | 0x80-0x81
		fonts.latinCharMap = {
			[0x01]: '↑', [0x02]: '→', [0x03]: '↓', [0x04]: '←',
			[0x09]: '♥', [0x0a]: '♪', [0x0b]: '★',
			[0x20]: ' ', [0x21]: '!', [0x22]: '"', [0x23]: '#', [0x24]: '$', [0x25]: '%', [0x26]: '&', [0x27]: '\'',
			[0x28]: '(', [0x29]: ')', [0x2a]: '*', [0x2b]: '+', [0x2c]: ',', [0x2d]: '-', [0x2e]: '.', [0x2f]: '/',
			[0x30]: '0', [0x31]: '1', [0x32]: '2', [0x33]: '3', [0x34]: '4', [0x35]: '5', [0x36]: '6', [0x37]: '7',
			[0x38]: '8', [0x39]: '9', [0x3a]: ':', [0x3b]: ';', [0x3d]: '=', [0x3f]: '?',
			[0x41]: 'A', [0x42]: 'B', [0x43]: 'C', [0x44]: 'D', [0x45]: 'E', [0x46]: 'F', [0x47]: 'G',
			[0x48]: 'H', [0x49]: 'I', [0x4a]: 'J', [0x4b]: 'K', [0x4c]: 'L', [0x4d]: 'M', [0x4e]: 'N', [0x4f]: 'O',
			[0x50]: 'P', [0x51]: 'Q', [0x52]: 'R', [0x53]: 'S', [0x54]: 'T', [0x55]: 'U', [0x56]: 'V', [0x57]: 'W',
			[0x58]: 'X', [0x59]: 'Y', [0x5a]: 'Z', [0x5b]: '[', [0x5c]: '\\', [0x5d]: ']', [0x5f]: '_',
			[0x61]: 'a', [0x62]: 'b', [0x63]: 'c', [0x64]: 'd', [0x65]: 'e', [0x66]: 'f', [0x67]: 'g',
			[0x68]: 'h', [0x69]: 'i', [0x6a]: 'j', [0x6b]: 'k', [0x6c]: 'l', [0x6d]: 'm', [0x6e]: 'n', [0x6f]: 'o',
			[0x70]: 'p', [0x71]: 'q', [0x72]: 'r', [0x73]: 's', [0x74]: 't', [0x75]: 'u', [0x76]: 'v', [0x77]: 'w',
			[0x78]: 'x', [0x79]: 'y', [0x7a]: 'z', [0x7b]: '{', [0x7d]: '}', [0x7e]: '~',
			[0x82]: '‚', [0x84]: '„', [0x85]: '…', [0x86]: '●',
			[0x88]: '▲', [0x8a]: '■', [0x8c]: 'Œ',
			[0x91]: '‘', [0x92]: '’', [0x93]: '“', [0x94]: '”',
			[0x9c]: 'œ',
			[0xa1]: '¡', [0xa5]: '¥',
			[0xaa]: 'ª', [0xab]: '«',
			[0xb0]: '°',
			[0xba]: 'º', [0xbb]: '»', [0xbf]: '¿',
			[0xc0]: 'À', [0xc1]: 'Á', [0xc2]: 'Â', [0xc4]: 'Ä', [0xc5]: 'Å', [0xc7]: 'Ç',
			[0xc8]: 'È', [0xc9]: 'É', [0xca]: 'Ê', [0xcb]: 'Ë', [0xcc]: 'Ì', [0xcd]: 'Í', [0xce]: 'Î', [0xcf]: 'Ï',
			[0xd1]: 'Ñ', [0xd2]: 'Ò', [0xd3]: 'Ó', [0xd4]: 'Ô', [0xd6]: 'Ö',
			[0xd9]: 'Ù', [0xda]: 'Ú', [0xdb]: 'Û', [0xdc]: 'Ü', [0xdf]: 'ß',
			[0xe0]: 'à', [0xe1]: 'á', [0xe2]: 'â', [0xe4]: 'ä', [0xe5]: 'å', [0xe6]: 'æ', [0xe7]: 'ç',
			[0xe8]: 'è', [0xe9]: 'é', [0xea]: 'ê', [0xeb]: 'ë', [0xec]: 'ì', [0xed]: 'í', [0xee]: 'î', [0xef]: 'ï',
			[0xf1]: 'ñ', [0xf2]: 'ò', [0xf3]: 'ó', [0xf4]: 'ô', [0xf6]: 'ö',
			[0xf9]: 'ù', [0xfa]: 'ú', [0xfb]: 'û', [0xfc]: 'ü',
		};

		// unmappable: 0x0c | 0x2a
		// 0x3d is "=" in Latin but it has special meaning in Japanese and the glyph is different, sooo
		fonts.japaneseCharMap = {
			[0x01]: 'ガ', [0x02]: 'ギ', [0x03]: 'グ', [0x04]: 'ゲ', [0x05]: 'ゴ', [0x06]: 'ザ', [0x07]: 'ジ',
			[0x08]: 'ズ', [0x09]: 'ゼ', [0x0a]: 'ゾ', [0x0b]: 'ダ', [0x0d]: 'ヅ', [0x0e]: 'デ', [0x0f]: 'ド',
			[0x10]: 'バ', [0x11]: 'ビ', [0x12]: 'ブ', [0x13]: 'ベ', [0x14]: 'ボ', [0x15]: 'が', [0x16]: 'ぎ', [0x17]: 'ぐ',
			[0x18]: 'げ', [0x19]: 'ご', [0x1a]: 'ざ', [0x1b]: 'じ', [0x1c]: 'ず', [0x1d]: 'ぜ', [0x1e]: 'ぞ', [0x1f]: 'ゃ',
			[0x21]: '!', [0x22]: 'ゅ', [0x23]: 'ょ', [0x24]: 'っ', [0x25]: '%', [0x26]: '&', [0x27]: '\'',
			[0x28]: '(', [0x29]: ')', [0x2b]: '+', [0x2c]: ',', [0x2d]: '-', [0x2e]: '.', [0x2f]: '/',
			[0x30]: '0', [0x31]: '1', [0x32]: '2', [0x33]: '3', [0x34]: '4', [0x35]: '5', [0x36]: '6', [0x37]: '7',
			[0x38]: '8', [0x39]: '9', [0x3a]: ':', [0x3b]: ';', [0x3c]: '。', [0x3d]: '゠', [0x3e]: '、', [0x3f]: '?',
			[0x40]: 'ー', [0x41]: 'A', [0x42]: 'B', [0x43]: 'C', [0x44]: 'D', [0x45]: 'E', [0x46]: 'F', [0x47]: 'G',
			[0x48]: 'H', [0x49]: 'I', [0x4a]: 'J', [0x4b]: 'K', [0x4c]: 'L', [0x4d]: 'M', [0x4e]: 'N', [0x4f]: 'O',
			[0x50]: 'P', [0x51]: 'Q', [0x52]: 'R', [0x53]: 'S', [0x54]: 'T', [0x55]: 'U', [0x56]: 'V', [0x57]: 'W',
			[0x58]: 'X', [0x59]: 'Y', [0x5a]: 'Z', [0x5b]: '[', [0x5c]: '¥', [0x5d]: ']', [0x5e]: 'わ', [0x5f]: 'を',
			[0x60]: 'ん', [0x61]: 'a', [0x62]: 'b', [0x63]: 'c', [0x64]: 'd', [0x65]: 'e', [0x66]: 'f', [0x67]: 'g',
			[0x68]: 'h', [0x69]: 'i', [0x6a]: 'j', [0x6b]: 'k', [0x6c]: 'l', [0x6d]: 'm', [0x6e]: 'n', [0x6f]: 'o',
			[0x70]: 'p', [0x71]: 'q', [0x72]: 'r', [0x73]: 's', [0x74]: 't', [0x75]: 'u', [0x76]: 'v', [0x77]: 'w',
			[0x78]: 'x', [0x79]: 'y', [0x7a]: 'z', [0x7b]: 'ば', [0x7c]: 'び', [0x7d]: 'ぶ', [0x7e]: '〜', [0x7f]: 'ベ',
			[0x80]: 'ぼ', [0x81]: 'ぱ', [0x82]: 'ぴ', [0x83]: 'ぷ', [0x84]: 'ぺ', [0x85]: '…', [0x86]: 'ぽ', [0x87]: 'だ',
			[0x88]: 'ぢ', [0x89]: 'づ', [0x8a]: 'で', [0x8b]: 'ど', [0x8c]: 'ぁ', [0x8d]: 'ぃ', [0x8e]: 'ぅ', [0x8f]: 'ぇ',
			[0x90]: 'ぉ', [0x91]: 'あ', [0x92]: 'い', [0x93]: 'う', [0x94]: 'え', [0x95]: 'お', [0x96]: 'か', [0x97]: 'き',
			[0x98]: 'く', [0x99]: 'け', [0x9a]: 'こ', [0x9b]: 'さ', [0x9c]: 'し', [0x9d]: 'す', [0x9e]: 'せ', [0x9f]: 'そ',
			[0xa0]: '「', [0xa1]: '」', [0xa2]: 'ァ', [0xa3]: 'ィ', [0xa4]: 'ゥ', [0xa5]: 'ェ', [0xa6]: 'ォ', [0xa7]: 'ャ',
			[0xa8]: 'ュ', [0xa9]: 'ョ', [0xaa]: 'ッ', [0xab]: 'ア', [0xac]: 'イ', [0xad]: 'ウ', [0xae]: 'エ', [0xaf]: 'オ',
			[0xb0]: 'カ', [0xb1]: 'キ', [0xb2]: 'ク', [0xb3]: 'ケ', [0xb4]: 'コ', [0xb5]: 'サ', [0xb6]: 'シ', [0xb7]: 'ス',
			[0xb8]: 'セ', [0xb9]: 'ソ', [0xba]: 'タ', [0xbb]: 'チ', [0xbc]: 'ツ', [0xbd]: 'テ', [0xbe]: 'ト', [0xbf]: 'ナ',
			[0xc0]: 'ニ', [0xc1]: 'ヌ', [0xc2]: 'ネ', [0xc3]: 'ノ', [0xc4]: 'ハ', [0xc5]: 'ヒ', [0xc6]: 'フ', [0xc7]: 'ヘ',
			[0xc8]: 'ホ', [0xc9]: 'マ', [0xca]: 'ミ', [0xcb]: 'ム', [0xcc]: 'メ', [0xcd]: 'モ', [0xce]: 'ヤ', [0xcf]: 'ユ',
			[0xd0]: 'ヨ', [0xd1]: 'ラ', [0xd2]: 'リ', [0xd3]: 'ル', [0xd4]: 'レ', [0xd5]: 'ロ', [0xd6]: 'ワ', [0xd7]: 'ン',
			[0xd8]: 'パ', [0xd9]: 'ピ', [0xda]: 'プ', [0xdb]: 'ペ', [0xdc]: 'ポ', [0xdd]: 'た', [0xde]: 'ち', [0xdf]: 'つ',
			[0xe0]: 'て', [0xe1]: 'と', [0xe2]: 'な', [0xe3]: 'に', [0xe4]: 'ぬ', [0xe5]: 'ね', [0xe6]: 'の', [0xe7]: 'は',
			[0xe8]: 'ひ', [0xe9]: 'ふ', [0xea]: 'へ', [0xeb]: 'ほ', [0xec]: 'ま', [0xed]: 'み', [0xee]: 'む', [0xef]: 'め',
			[0xf0]: 'も', [0xf1]: 'や', [0xf2]: 'ゆ', [0xf3]: 'よ', [0xf4]: 'ら', [0xf5]: 'り', [0xf6]: 'る', [0xf7]: 'れ',
			[0xf8]: 'ろ',
		};

		// mapped by @PaperSplash THANK YOU!!!
		fonts.japaneseExtendedCharMap = {
		    [0x01]: 'ヲ', [0x02]: 'ヴ', [0x03]: '↑', [0x04]: '→', [0x05]: '↓', [0x06]: '←', [0x07]: '上',
		    [0x08]: '下', [0x09]: '左', [0x0A]: '右', [0x0B]: '十', [0x0C]: '字', [0x0D]: '決', [0x0E]: '定', [0x0F]: '戻',
		    [0x10]: '回', [0x11]: '復', [0x12]: '操', [0x13]: '作', [0x14]: '女', [0x15]: '王', [0x16]: '攻', [0x17]: '撃',
		    [0x18]: '使', [0x19]: '大', [0x1A]: '事', [0x1B]: '目', [0x1C]: '変', [0x1D]: '化', [0x1E]: '自', [0x1F]: '動',
		    [0x20]: '転', [0x21]: '毎', [0x22]: '返', [0x23]: '開', [0x24]: '始', [0x25]: '重', [0x26]: '力', [0x27]: '軽',
		    [0x28]: '服', [0x29]: '体', [0x2A]: '技', [0x2B]: '早', [0x2C]: '打', [0x2D]: '倍', [0x2E]: '効', [0x2F]: '果',
		    [0x30]: '品', [0x31]: '用', [0x32]: '国', [0x33]: '見', [0x34]: '入', [0x35]: '美', [0x36]: '赤', [0x37]: '緑',
		    [0x38]: '青', [0x39]: '黄', [0x3A]: '白', [0x3B]: '色', [0x3C]: '実', [0x3D]: '人', [0x3E]: '味', [0x3F]: '甘',
		    [0x40]: '恋', [0x41]: '号', [0x42]: '会', [0x43]: '員', [0x44]: '安', [0x45]: '光', [0x46]: '着',  [0x47]: '草',
		    [0x48]: '新', [0x49]: '岩', [0x4A]: '世', [0x4B]: 'ヶ', [0x4C]: '原', [0x4D]: '星', [0x4E]: '村', [0x4F]: '頂',
		    [0x50]: '城', [0x51]: '周', [0x52]: '辺', [0x53]: '東', [0x54]: '西', [0x55]: '南', [0x56]: '北', [0x57]: '町',
		    [0x58]: '森', [0x59]: '海', [0x5A]: '空', [0x5B]: '港', [0x5C]: '本', [0x5D]: '当', [0x5E]: '消', [0x5F]: '全',
		    [0x60]: '成', [0x61]: '功', [0x62]: '側', [0x63]: '店', [0x64]: '長', [0x65]: '水', [0x66]: '悪', [0x67]: '手',
		   	[0x68]: '者', [0x69]: '防', [0x6A]: '金', [0x6B]: '貨', [0x6C]: '戦', [0x6D]: '抜', [0x6E]: '切', [0x6F]: '初',
		    [0x70]: '心', [0x71]: '身', [0x72]: '付', [0x73]: '宇', [0x74]: '宙', [0x75]: '行', [0x76]: '与', [0x77]: '続',
		    [0x78]: '終', [0x79]: '豆', [0x7A]: '完', [0x7B]: '了', [0x7C]: '地', [0x7D]: '木', [0x7E]: '道',  [0x7F]: '前',
		    [0x80]: '底', [0x81]: '出', [0x82]: '点', [0x83]: '中', [0x84]: '館', [0x85]: '口',  [0x86]: '再', [0x87]: '広',
		    [0x88]: '場', [0x89]: '浜', [0x8A]: '部', [0x8B]: '屋', [0x8C]: '買', [0x8D]: '売', [0x8E]: '皮', [0x8F]: '反',
		    [0x90]: '少', [0x91]: '間', [0x92]: '文', [0x93]: '明', [0x94]: '通', [0x95]: '路', [0x96]: '子', [0x97]: '活',
		    [0x98]: '宝', [0x99]: '石', [0x9A]: '時', [0x9B]: '代', [0x9C]: 'ヂ', [0x9D]: '姫',

			[0xA0]: '症', [0xA1]: '病', [0xA2]: '内', [0xA3]: '倒', [0xA5]: '件',
			[0xFB]: '♥', [0xFC]: '♪',
			[0x101]: '両', [0x102]: '業', [0x103]: '曲', [0x104]: '利', [0x106]: '飲', [0x107]: '運',
			[0x108]: '央', [0x10A]: '音', [0x10C]: '客', [0x10D]: '究', [0x10E]: '級',
			[0x110]: '去', [0x111]: '橋', [0x112]: '区', [0x117]: '幸',
			[0x11A]: '仕', [0x11B]: '死', [0x11C]: '花', [0x11D]: '料', [0x11E]: '守', [0x11F]: '取',
			[0x121]: '集', [0x123]: '宿', [0x125]: '助', [0x126]: '乗', [0x127]: '植',
			[0x128]: '神', [0x129]: '真', [0x12A]: '深', [0x12D]: '街', [0x12E]: '想', [0x12F]: '息',
			[0x130]: '族', [0x131]: '他', [0x132]: '対', [0x133]: '第', [0x134]: '調', [0x135]: '庭', [0x137]: '農',
			[0x138]: '畑', [0x13D]: '秒',
			[0x140]: '物', [0x141]: '勉', [0x142]: '命', [0x143]: '役', [0x144]: '有', [0x145]: '遊', [0x146]: '葉',
			[0x148]: '流', [0x149]: '旅', [0x14A]: '医', [0x14C]: '育', [0x14F]: '泳',
			[0x151]: '横', [0x152]: '温', [0x154]: '界', [0x155]: '階', [0x156]: '寒', [0x157]: '感',
			[0x15B]: '起', [0x15D]: '急', [0x15F]: '局',
			[0x161]: '苦', [0x162]: '具', [0x163]: '君', [0x164]: '係', [0x165]: '鳥', [0x166]: '研', [0x167]: '湖',
			[0x168]: '根', [0x169]: '車', [0x16A]: '指', [0x16B]: '歯', [0x16D]: '次', [0x16E]: '男', [0x16F]: '持',
			[0x171]: '名', [0x172]: '写', [0x173]: '受', [0x174]: '拾', [0x176]: '習', [0x177]: '住',
			[0x178]: '所', [0x17B]: '商', [0x17C]: '勝', [0x17D]: '進', [0x17E]: '昔', [0x17F]: '相',
			[0x180]: '送', [0x181]: '速', [0x183]: '待', [0x185]: '題',
			[0x188]: '談', [0x18A]: '注', [0x18B]: '柱', [0x18C]: '追', [0x18D]: '天',
			[0x191]: '都', [0x192]: '度', [0x193]: '島', [0x195]: '登', [0x197]: '親',
			[0x199]: '波', [0x19B]: '箱', [0x19C]: '発',
			[0x1A0]: '鼻', [0x1A2]: '表', [0x1A4]: '負', [0x1A7]: '友',
			[0x1A8]: '問', [0x1A9]: '薬', [0x1AA]: '油', [0x1AC]: '様', [0x1AD]: '落', [0x1AE]: '礼',
			[0x1B0]: '練', [0x1B2]: '和', [0x1B4]: '栄', [0x1B5]: '組', [0x1B6]: '求',
			[0x1BB]: '束', [0x1BE]: '飛', [0x1BF]: '必',
			[0x1C0]: '不', [0x1C2]: '未', [0x1C3]: '無', [0x1C4]: '要', [0x1C5]: '良', [0x1C6]: '老',
			[0x1C9]: '以', [0x1CA]: '位', [0x1CB]: '胃', [0x1CC]: '印', [0x1CD]: '加', [0x1CE]: '官', [0x1CF]: '希',
			[0x1D0]: '器', [0x1D1]: '共', [0x1D3]: '好', [0x1D4]: '告', [0x1D5]: '最',
			[0x1D8]: '参', [0x1D9]: '史', [0x1DB]: '祝', [0x1DD]: '信',
			[0x1E7]: '改',
			[0x1E9]: '別', [0x1EB]: '民', [0x1EE]: '令', [0x1EF]: '連',
			[0x1F0]: '労', [0x1F1]: '愛', [0x1F2]: '案', [0x1F7]: '聞',
			[0x1F8]: '答', [0x1F9]: '歌', [0x1FA]: '声', [0x1FB]: '絵', [0x1FC]: '画', [0x1FE]: '覚',
			[0x200]: '管', [0x201]: '関', [0x202]: '観', [0x203]: '願', [0x204]: '季', [0x205]: '紀',
			[0x208]: '機', [0x209]: '議', [0x20A]: '泣', [0x20B]: '救', [0x20C]: '給', [0x20F]: '協',
			[0x212]: '訓', [0x213]: '軍', [0x216]: '型', [0x217]: '景',
			[0x21A]: '結', [0x21B]: '建', [0x21C]: '健', [0x21D]: '験',
			[0x222]: '康', [0x223]: '差', [0x224]: '菜',
			[0x228]: '察', [0x229]: '産', [0x22A]: '散', [0x22B]: '残', [0x22D]: '試',
			[0x230]: '失', [0x232]: '種', [0x234]: '順', [0x236]: '笑',
			[0x238]: '焼', [0x23A]: '賞', [0x23E]: '静', [0x23F]: '席',
			[0x241]: '節', [0x242]: '説', [0x245]: '選', [0x246]: '然', [0x247]: '理',
			[0x24A]: '達', [0x24B]: '置', [0x24C]: '仲', [0x24E]: '低',
			[0x251]: '的', [0x252]: '伝', [0x254]: '努', [0x256]: '堂', [0x257]: '特',
			[0x258]: '得', [0x259]: '熱', [0x25A]: '念', [0x25B]: '敗', [0x25F]: '費',
			[0x261]: '標', [0x264]: '粉', [0x267]: '法',
			[0x268]: '望', [0x269]: '満', [0x26A]: '約', [0x26D]: '浴', [0x26F]: '量',
			[0x270]: '類', [0x271]: '冷', [0x272]: '例', [0x273]: '歴',
			[0x279]: '支', [0x27A]: '非', [0x27B]: '因', [0x27C]: '永', [0x27F]: '示',
			[0x281]: '制', [0x282]: '性', [0x283]: '製', [0x285]: '断', [0x286]: '燃',
			[0x288]: '保', [0x28A]: '圧', [0x28B]: '移', [0x28C]: '営', [0x28D]: '液', [0x28E]: '演', [0x28F]: '応',
			[0x292]: '恩', [0x293]: '可', [0x294]: '仮', [0x295]: '価', [0x297]: '過',
			[0x29A]: '解', [0x29B]: '格', [0x29C]: '確', [0x29D]: '額',
			[0x2A0]: '慣', [0x2A2]: '基', [0x2A6]: '義', [0x2A7]: '逆',
			[0x2A9]: '居', [0x2AD]: '禁', [0x2AE]: '句',
			[0x2B0]: '経', [0x2B4]: '検', [0x2B5]: '限', [0x2B6]: '現', [0x2B7]: '減',
			[0x2B8]: '個', [0x2BE]: '構',
			[0x2C1]: '混', [0x2C2]: '査', [0x2C6]: '在', [0x2C7]: '財',
			[0x2C9]: '雑', [0x2CB]: '賛', [0x2CE]: '師',
			[0x2D1]: '似', [0x2D2]: '識', [0x2D3]: '質', [0x2D5]: '謝', [0x2D7]: '勢',
			[0x2D8]: '精', [0x2D9]: '税', [0x2DA]: '責', [0x2DC]: '接', [0x2DD]: '設', [0x2DF]: '絶',
			[0x2E1]: '祖', [0x2E4]: '造', [0x2E5]: '像',
			[0x2EA]: '退', [0x2EC]: '態', [0x2ED]: '団', [0x2EF]: '張',
			[0x2F0]: '提', [0x2F1]: '程', [0x2F3]: '敵', [0x2F6]: '導',
			[0x2F8]: '独', [0x2F9]: '任', [0x2FA]: '能', [0x2FB]: '破', [0x2FC]: '犯', [0x2FE]: '比',
			[0x300]: '備',
			[0x308]: '虫', [0x309]: '複', [0x30D]: '報',
			[0x313]: '夢', [0x314]: '迷', [0x317]: '容',
			[0x31B]: '異', [0x31E]: '系',
			[0x327]: '並',
			[0x32B]: '危', [0x32D]: '筋',
			[0x330]: '降', [0x333]: '骨', [0x335]: '砂', [0x336]: '座',
			[0x338]: '策', [0x33B]: '姿', [0x33C]: '射',
			[0x345]: '段', [0x346]: '難',
			[0x35C]: '揮', [0x35D]: '貴', [0x35E]: '疑', [0x35F]: '吸',
			[0x360]: '供', [0x367]: '穴',
			[0x369]: '権', [0x36B]: '源', [0x36D]: '呼',
			[0x372]: '視', [0x373]: '詞', [0x376]: '捨', [0x377]: '若',
			[0x379]: '収',
			[0x382]: '除',
			[0x38C]: '聖', [0x38E]: '宣',
			[0x390]: '洗', [0x391]: '窓', [0x393]: '装',
			[0x398]: '存', [0x399]: '宅', [0x39A]: '担', [0x39B]: '探', [0x39E]: '値',
			[0x3A6]: '痛', [0x3A7]: '展',
			[0x3AC]: '認', [0x3AF]: '背',
			[0x3B6]: '腹',
			[0x3B8]: '閉', [0x3BA]: '暮', [0x3BD]: '忘',
			[0x3C2]: '模',
			[0x3C9]: '裏', [0x3CE]: '暗', [0x3CF]: '意',
			[0x3D0]: '足', [0x3D1]: '放', [0x3D2]: '玉', [0x3D4]: '枚',
			[0x3D9]: '険', [0x3DD]: '修', [0x3DF]: '術',
			[0x3E0]: '準', [0x3E4]: '証', [0x3E6]: '状', [0x3E7]: '常',
			[0x3E8]: '情', [0x3EA]: '予', [0x3EC]: '判', [0x3EE]: '向',
			[0x3F0]: '主', [0x3F3]: '申', [0x3F4]: '配', [0x3F7]: '平',
			[0x3F8]: '面', [0x3F9]: '由', [0x3FA]: '倉', [0x3FB]: '庫', [0x3FD]: '録', [0x3FF]: '冒',
			[0x400]: '択', [0x401]: '押', [0x402]: '肩', [0x404]: '浮', [0x405]: '突', [0x407]: '込',
			[0x408]: '怒', [0x409]: '避', [0x40A]: '彼', [0x40C]: '舞', [0x40F]: '爆',
			[0x414]: '奥', [0x417]: '到',
			[0x41B]: '逃', [0x41C]: '匹', [0x41D]: '頼', [0x41E]: '休',
			[0x421]: '火', [0x423]: '超',
			[0x42B]: '床',
			[0x431]: '先', [0x432]: '整', [0x433]: '魔', [0x435]: '気',
			[0x43B]: '一', [0x43D]: '三', [0x43E]: '四',
			[0x444]: '年', [0x445]: '月', [0x446]: '日',
			[0x448]: '船', [0x449]: '工', [0x44A]: '土', [0x44B]: '正', [0x44C]: '黒', [0x44E]: '生', [0x44F]: '風',
			[0x453]: '小', [0x454]: '池', [0x456]: '教', [0x457]: '野',
			[0x458]: '耳', [0x459]: '才', [0x45A]: '父', [0x45B]: '母', [0x45C]: '兄', [0x45D]: '弟',
			[0x460]: '多', [0x462]: '頭', [0x463]: '顔', [0x465]: '肉', [0x467]: '食',
			[0x468]: '茶', [0x469]: '家', [0x46A]: '室', [0x46E]: '台',
			[0x470]: '週', [0x473]: '分', [0x474]: '朝', [0x477]: '夜',
			[0x478]: '古', [0x479]: '今', [0x47B]: '数', [0x47D]: '計', [0x47E]: '半', [0x47F]: '何',
			[0x480]: '番', [0x481]: '元', [0x482]: '後', [0x484]: '外', [0x485]: '角',
			[0x489]: '矢', [0x48B]: '方', [0x48C]: '形', [0x48D]: '社', [0x48F]: '線',
			[0x490]: '直', [0x491]: '丸', [0x492]: '電', [0x493]: '太', [0x494]: '細', [0x495]: '高', [0x497]: '遠',
			[0x498]: '近', [0x499]: '読', [0x49A]: '書', [0x49B]: '強', [0x49C]: '弱', [0x49D]: '同', [0x49E]: '立', [0x49F]: '記',
			[0x4A0]: '交', [0x4A1]: '引', [0x4A2]: '合',    [0x4A3]: '歩', [0x4A4]: '走', [0x4A5]: '来', [0x4A6]: '帰',
			[0x4A8]: '止', [0x4AB]: '楽', [0x4AC]: '思', [0x4AD]: '考', [0x4AE]: '知', [0x4AF]: '言',
			[0x4B0]: '話', [0x4B1]: '語', [0x4B2]: '賢', [0x4B3]: '患', [0x4B4]: '封',
		};

		fonts.koreanCharMap = {};

		fonts.koreanExtendedCharMap = {};

		fonts.pickCharMaps = language => {
			if (language === 0) {
				// JP/KO (prefer Japanese, because NA/EU demo versions have some JP text leftover)
				if (headers.gamecode === 'CLJK') return [fonts.koreanCharMap, fonts.koreanExtendedCharMap];
				else return [fonts.japaneseCharMap, fonts.japaneseExtendedCharMap];
			} else {
				// English, French, Spanish, German, Italian (these don't support replacement characters)
				return [fonts.latinCharMap, undefined];
			}
		};

		const fontPalette = fonts.palette = rgb15To32(bufToU16(fsext.fontPalette || new Uint16Array([
			// same as the default light palette
			0x6bdf, 0x190c, 0x6f9d, 0x1d0a, 0x3698, 0x533c, 0x6bdf, 0x7fff,
			0x0300, 0x6ffc, 0x01ff, 0x639f, 0x7d66, 0x7bdc, 0x001f, 0x6b5f,
			// same as the default dark palette
			0x5ac0, 0x7fff, 0x458d, 0x1d0a, 0x1cc6, 0x30c7, 0x30e8, 0x3d4b,
			0x03a0, 0x2585, 0x1e7f, 0x2d2d, 0x7ee4, 0x4546, 0x181f, 0x288d,
		])));

		const paletteOptions = ['Light', 'Dark'];
		for (let i = 2; i * 16 < fontPalette.length; ++i) {
			paletteOptions.push(`Pal Row ${i}`);
		}
		const fontPaletteSelect = dropdown(paletteOptions, 0, () => updatePalette());
		section.appendChild(fontPaletteSelect);

		const fontPaletteDisplay = document.createElement('canvas');
		fontPaletteDisplay.width = 16;
		fontPaletteDisplay.height = 1;
		fontPaletteDisplay.style.cssText = `height: 22px; width: ${22*16}px; display: inline-block; vertical-align: center`;
		section.appendChild(fontPaletteDisplay);

		const fontFileNames = [
			'/Font/StatFontSet.dat',
			'/FEvent/FEvent.dat',
			'/BAI/BMes_cf.dat',
			'/BAI/BMes_ji.dat',
			'/BAI/BMes_yo.dat',
			'/MAI/MMes_yo.dat',
			'/SAI/SMes_yo.dat',
			'/BDataMiniGame/',
			'/EDataSave/',
			'Embedded',
		];
		let fontFileDropdown = dropdown(fontFileNames, 0, () => updateFontFileSelection());
		section.appendChild(fontFileDropdown);

		let fontSelections = [];
		let fontSelectionDropdown = dropdown([''], 0, () => {});
		section.appendChild(fontSelectionDropdown);

		const showCharMap = checkbox('Show Character Map', false, () => updateFontPreview());
		section.appendChild(showCharMap);

		const showLetterWidths = checkbox('Show Letter Widths', true, () => updateFontPreview());
		section.appendChild(showLetterWidths);

		const previewContainer = document.createElement('div');
		previewContainer.style.cssText = 'display: grid; grid-template-columns: 200px auto; margin-top: 5px';
		section.appendChild(previewContainer);

		const charPreview = document.createElement('div');
		charPreview.style.cssText = 'width: 200px; height: fit-content; grid-column: 1; position: sticky; top: 0';
		previewContainer.appendChild(charPreview);

		const charPreviewCanvas = document.createElement('canvas');
		charPreviewCanvas.width = charPreviewCanvas.height = 200; // temp
		charPreview.appendChild(charPreviewCanvas);

		const charPreviewList = document.createElement('div');
		charPreview.appendChild(charPreviewList);

		const fontPreview = document.createElement('div');
		fontPreview.style.cssText = 'width: 800px; height: fit-content; grid-column: 2';
		previewContainer.appendChild(fontPreview);

		fonts.unpack = dat => {
			const charMapSize = dat.getUint32(0, true);
			const charMapOffset = dat.getUint32(4, true);

			let o = 8;
			const glyphTableOffsets = [];
			do {
				glyphTableOffsets.push(dat.getUint32(o, true));
				o += 4;
			} while (o < glyphTableOffsets[0]);

			const glyphTables = [];
			for (let i = 0; i < glyphTableOffsets.length; ++i) {
				// segments go: [glyphTable1, ..., glyphTableN, charMap]
				const tableDat = sliceDataView(dat, glyphTableOffsets[i], glyphTableOffsets[i + 1] ?? charMapOffset);
				const glyphWidth = (tableDat.getUint8(0) >> 4) * 4;
				const glyphHeight = (tableDat.getUint8(0) & 0xf) * 4;
				const letterWidthSize = tableDat.getUint8(3) * 4;

				const letterWidths = [];
				o = 4;
				if (glyphWidth <= 16) {
					for (let j = 0; j < letterWidthSize; ++j) {
						const composite = tableDat.getUint8(o++);
						letterWidths.push(composite & 0xf, composite >> 4);
					}
				} else {
					for (let j = 0; j < letterWidthSize / 2; ++j) {
						const composite = tableDat.getUint8(o++);
						letterWidths.push(composite & 0xf, composite >> 4);
					}

					for (let j = 0; j < letterWidthSize / 2; ++j) {
						const composite = tableDat.getUint8(o++);
						letterWidths[j*2] |= (composite & 0xf) << 4;
						letterWidths[j*2 + 1] |= composite & 0xf0;
					}
				}

				const glyphs = [];
				if (glyphWidth || glyphHeight) {
					for (let letterIndex = 0; o < tableDat.byteLength; ++letterIndex) {
						o = 4 + letterWidthSize + letterIndex * glyphWidth * glyphHeight / 4;
						const bitmap = new Uint8Array(glyphWidth * glyphHeight);
						for (let baseX = 0; baseX + 7 < glyphWidth; baseX += 8) {
							for (let baseY = 0; baseY < glyphHeight; baseY += 4) {
								const alpha = tableDat.getUint32(o, true);
								const alt = tableDat.getUint32(o + 4, true);
								o += 8;
								for (let x = 0, bit = 0; x < 8; ++x) {
									for (let y = 0; y < 4; ++y, ++bit) {
										const clearBit = (alpha >>> bit) & 1;
										const colorBit = (alt >>> bit) & 1;
										bitmap[(baseY + y) * glyphWidth + baseX + x] = clearBit << 1 | colorBit;
									}
								}
							}
						}

						if (glyphWidth % 8) {
							const baseX = glyphWidth - 4;
							for (let baseY = 0; baseY < glyphHeight; baseY += 4) {
								const alpha = tableDat.getUint16(o, true);
								const alt = tableDat.getUint16(o + 2, true);
								o += 4;
								for (let x = 0, bit = 0; x < 4; ++x) {
									for (let y = 0; y < 4; ++y, ++bit) {
										const clearBit = (alpha >>> bit) & 1;
										const colorBit = (alt >>> bit) & 1;
										bitmap[(baseY + y) * glyphWidth + baseX + x] = clearBit << 1 | colorBit;
									}
								}
							}
						}

						glyphs.push({ bitmap, letterWidth: letterWidths[letterIndex] + 1 });
					}
				}

				glyphTables.push({
					dat: tableDat,
					glyphWidth,
					glyphHeight,
					glyphs,
				});
			}

			const charMap = sliceDataView(dat, charMapOffset, charMapOffset + charMapSize);
			return { charMap, glyphTables };
		};

		fonts.drawGlyph = (bitmap, bitmapWidth, bitmapHeight, bitmapX, bitmapY, glyphBitmap, glyphWidth, glyphHeight, mainColor, altColor) => {
			for (let y = 0; y < glyphHeight; ++y) {
				for (let x = 0; x < glyphWidth; ++x) {
					const pos = (bitmapY + y) * bitmapWidth + bitmapX + x;
					const pixel = glyphBitmap[y * glyphWidth + x];
					if (pixel === 0b00); // clear=0, color=0 => do nothing
					else if (pixel === 0b01) bitmap[pos] = 0xff0000ff; // clear=0, color=1 => corruption!!1
					else if (pixel === 0b10) bitmap[pos] = mainColor; // clear=1, color=0 => main color
					else if (pixel === 0b11) bitmap[pos] = altColor; // clear=1, color=1 => alt color
				}
			}
		};

		const updateFontFileSelection = () => {
			const findMiniFonts = table => {
				if (!table.byteLength) return [];
				const columns = unpackSegmentedFile(table, 0, table);
				const miniFonts = [];
				for (let j = 0; j < 30; ++j) {
					if (!columns[j].byteLength) continue;
					miniFonts.push([`<code>[${j}]</code> ${fonts.languageNamesWithFonts[j]}`, columns[j]]);
				}

				return miniFonts;
			};

			fontSelections = [];
			if (fontFileDropdown.value === 0) {
				// /Font/StatFontSet.dat
				const f = fs.get('/Font/StatFontSet.dat');
				const segments = unpackSegmentedFile(f, 0, f);
				// [-1] is just file padding
				for (let i = 0; i < segments.length - 1; ++i) {
					if (segments[i].byteLength) fontSelections.push([String(i), [[undefined, segments[i]]]]);
				}
			} else if (fontFileDropdown.value === 1) {
				// /FEvent/FEvent.dat
				for (let i = 2, room = 0; i < fsext.fevent.length; i += 3, ++room) {
					const miniFonts = findMiniFonts(fsext.fevent[i]);
					if (miniFonts.length) fontSelections.push([`Room 0x${room.toString(16)}`, miniFonts]);
				}
			} else if (2 <= fontFileDropdown.value && fontFileDropdown.value <= 4) {
				const paths = ['/BAI/BMes_cf.dat', '/BAI/BMes_ji.dat', '/BAI/BMes_yo.dat'];
				const tables = fsext.battle.get(paths[fontFileDropdown.value - 2]);
				for (let i = 0; i < tables.length; ++i) {
					const miniFonts = findMiniFonts(tables[i]);
					if (miniFonts.length) fontSelections.push([`Table 0x${i.toString(16)}`, miniFonts]);
				}
			} else if (5 <= fontFileDropdown.value && fontFileDropdown.value <= 6) {
				const paths = ['/MAI/MMes_yo.dat', '/SAI/SMes_yo.dat'];
				const f = fs.get(paths[fontFileDropdown.value - 5]);
				const tables = unpackSegmentedFile(f, 0, f);
				for (let i = 0; i < tables.length - 1; ++i) {
					const miniFonts = findMiniFonts(tables[i]);
					if (miniFonts.length) fontSelections.push([`Table 0x${i.toString(16)}`, miniFonts]);
				}
			} else if (fontFileDropdown.value === 7) {
				const miniFonts = findMiniFonts(fs.get('/BDataMiniGame/mfset_MesDat_MiniGame.dat'));
				if (miniFonts.length) fontSelections.push([undefined, miniFonts]);
			} else if (fontFileDropdown.value === 8) {
				const paths = [
					'mfset_EMesJig.dat',
					'mfset_EMesOutline.dat',
					'mfset_EMesPlace.dat',
					'mfset_EMesSys.dat',
				];
				for (const path of paths) {
					const miniFonts = findMiniFonts(fs.get('/EDataSave/' + path));
					fontSelections.push([path, miniFonts]); // do NOT check miniFonts.length
				}
			} else if (fontFileDropdown.value === 9) {
				// scan for fonts in code
				const check = (dat, o) => {
					if (o + 0xc > dat.byteLength) return 0;
					const charMapSize = dat.getUint32(o, true);
					const charMapOffset = dat.getUint32(o + 4, true);
					if (!charMapOffset || !charMapSize) return 0;
					if (o + charMapOffset + charMapSize > dat.byteLength) return 0;
					if ((charMapOffset & 3) || (charMapSize & 1)) return 0;

					// check glyph table
					const firstGlyphTableOffset = dat.getUint32(o + 8, true);
					if ((o + firstGlyphTableOffset + 4 > dat.byteLength) || (firstGlyphTableOffset & 3)) return 0;
					if (firstGlyphTableOffset < 0xc) return 0;

					let glyphTableMaxEntries = 0;
					for (let o2 = 8; o2 < firstGlyphTableOffset; o2 += 4) {
						const glyphTableOffset = dat.getUint32(o + o2, true);
						if ((o + glyphTableOffset + 4 > dat.byteLength) || (glyphTableOffset & 3)) return 0;

						const glyphTableWidth = (dat.getUint8(o + glyphTableOffset) >> 4) * 4;
						const glyphTableHeight = (dat.getUint8(o + glyphTableOffset) & 0xf) * 4;
						if (glyphTableWidth < 8 || glyphTableHeight < 8) return 0;

						const letterWidthSize = dat.getUint8(o + glyphTableOffset + 3) * 4;
						const minGlyphs = 16 < glyphTableWidth ? (letterWidthSize >> 2) : (letterWidthSize >> 3);
						if (o + glyphTableOffset + 4 + letterWidthSize + minGlyphs * glyphTableWidth * glyphTableHeight / 4 > dat.byteLength) return 0;

						if (o2 === 8) {
							glyphTableMaxEntries = (charMapOffset - firstGlyphTableOffset - 4 - letterWidthSize) / (glyphTableWidth * glyphTableHeight / 4);
						}
					}

					// check char map
					let anySeen = false;
					for (let o2 = 0; o2 < charMapSize; o2 += 2) {
						const tableIndex = dat.getUint8(o + charMapOffset + o2);
						const glyphIndex = dat.getUint8(o + charMapOffset + o2 + 1);
						if (tableIndex === 0xff && glyphIndex === 0xff) continue;

						anySeen = true;
						if (tableIndex >= 6) return 0; // definitely not
						if (tableIndex === 0 && glyphIndex >= glyphTableMaxEntries) return 0;
					}

					if (!anySeen) return 0;

					return charMapOffset + charMapSize;
				};

				const scan = (label, dat, ramStart) => {
					for (let o = 0; o < dat.byteLength; o += 4) {
						const size = check(dat, o);
						if (!size) continue;
						
						const fontDat = sliceDataView(dat, o, o + size);
						fontSelections.push([`${label} @ 0x${str32(ramStart + o)}, len 0x${size.toString(16)}`, [[undefined, fontDat]]]);
					}
				};

				scan('ARM9', fs.arm9, headers.arm9RamOffset);
				for (const ov of ovt.overlays) {
					scan(`ov${String(ov.id).padStart(3, '0')}`, fs.overlay(ov.id, true), ov.ramStart);
				}
			}

			if (fontSelections.length <= 1) {
				fontSelectionDropdown.select(0, true);
				fontSelectionDropdown.style.display = 'none';
			} else {
				const newDropdown = dropdown(fontSelections.map(x => x[0]), 0, () => updateFontPreview());
				fontSelectionDropdown.replaceWith(newDropdown);
				fontSelectionDropdown = newDropdown;
			}

			updateFontPreview();
		};

		const updatePalette = () => {
			const palCtx = fontPaletteDisplay.getContext('2d');
			const palette = sliceDataView(bufToDat(fontPalette), fontPaletteSelect.value * 64, fontPaletteSelect.value * 64 + 64);
			palCtx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 1), 0, 0);

			updateFontPreview();
		};

		const updateFontPreview = () => {
			fontPreview.innerHTML = '';
			const dats = fontSelections[fontSelectionDropdown.value]?.[1];
			if (!dats?.length) {
				addHTML(fontPreview, '<div>No fonts found</div>');
				return;
			}

			const palette = bufToU32(sliceDataView(bufToDat(fontPalette), fontPaletteSelect.value * 64, fontPaletteSelect.value * 64 + 64));

			const table = document.createElement('table');
			table.className = 'bordered';

			let selectedEntry = undefined;
			let onDeselect = undefined;
			let reoutlineSelected = undefined;
			const sheet = (entries, maxGlyphWidth, maxGlyphHeight) => {
				const bitmapWidth = Math.min(entries.length, 16) * (maxGlyphWidth + 3) + 1;
				const bitmapHeight = Math.ceil(entries.length / 16) * (maxGlyphHeight + 3) + 1;
				const bitmap = new Uint32Array(bitmapWidth * bitmapHeight);

				const sheetCanvas = document.createElement('canvas');
				sheetCanvas.width = bitmapWidth;
				sheetCanvas.height = bitmapHeight;
				sheetCanvas.style.cssText = `width: ${bitmapWidth * 2}px; height: ${bitmapHeight * 2}px`;

				for (let i = 0; i < entries.length; ++i) {
					const { glyphTable, glyphEntry } = entries[i];
					const outerBaseX = (maxGlyphWidth + 3) * (i & 0xf);
					const outerBaseY = (maxGlyphHeight + 3) * (i >> 4);
					const outerEndX = outerBaseX + maxGlyphWidth + 3;
					const outerEndY = outerBaseY + maxGlyphHeight + 3;

					// top line
					bitmap.fill(
						palette[5],
						outerBaseY * bitmapWidth + outerBaseX,
						outerBaseY * bitmapWidth + outerEndX + 1,
					);
					// bottom line
					bitmap.fill(
						palette[5],
						(outerBaseY + maxGlyphHeight + 3) * bitmapWidth + outerBaseX,
						(outerBaseY + maxGlyphHeight + 3) * bitmapWidth + outerEndX + 1,
					);
					for (let y = outerBaseY + 1; y < outerEndY; ++y) {
						bitmap[y * bitmapWidth + outerBaseX] = palette[5]; // left line
						bitmap[y * bitmapWidth + outerEndX] = palette[5]; // right line
					}

					const fillBox = color => {
						for (let y = outerBaseY + 1; y < outerEndY; ++y) {
							for (let x = outerBaseX + 1; x < outerEndX; ++x) {
								bitmap[y * bitmapWidth + x] = color;
							}
						}
					};

					if (glyphEntry === undefined) {
						fillBox(palette[4]); // no glyph, so show an empty, darkened glyph box
						continue;
					}

					if (glyphEntry === false) {
						fillBox(0xff0000ff); // INVALID glyph, so show a red box
						continue;
					}

					// valid glyph!
					fillBox(palette[6]); // valid glyph, so use the default textbox color

					// (bitmap, bitmapWidth, bitmapHeight, bitmapX, bitmapY, glyph, glyphWidth, glyphHeight, letterWidth, mainColor, altColor)
					fonts.drawGlyph(bitmap, bitmapWidth, bitmapHeight, outerBaseX + 2, outerBaseY + 2, glyphEntry.bitmap, glyphTable.glyphWidth, glyphTable.glyphHeight, palette[1], palette[2]);

					if (showLetterWidths.checked) {
						for (let x = 0; x < glyphEntry.letterWidth; ++x) {
							bitmap[(outerEndY - 1) * bitmapWidth + outerBaseX + 2 + x] = palette[0xa]; // orange
						}
					}
				}

				const sheetCtx = sheetCanvas.getContext('2d');
				sheetCtx.putImageData(new ImageData(bufToU8Clamped(bitmap), bitmapWidth, bitmapHeight), 0, 0);

				const outline = (index, color) => {
					const outerBaseX = (index & 0xf) * (maxGlyphWidth + 3);
					const outerBaseY = (index >> 4) * (maxGlyphHeight + 3);

					sheetCtx.strokeStyle = '#' + str8(color & 0xff) + str8(color >> 8 & 0xff) + str8(color >> 16 & 0xff);
					sheetCtx.strokeRect(outerBaseX + 0.5, outerBaseY + 0.5, maxGlyphWidth + 3, maxGlyphHeight + 3);
				};

				const select = index => {
					const entry = entries[index];
					const { glyphTable, glyphEntry, tableIndex, glyphIndex, charCodes } = entry;
					const { glyphWidth, glyphHeight } = glyphTable;

					selectedEntry = entry;
					onDeselect?.();
					onDeselect = () => outline(index, palette[5]);
					reoutlineSelected = () => outline(index, 0xff000000); // black outline
					reoutlineSelected();

					const previewBitmap = new Uint32Array(glyphWidth * glyphHeight);
					previewBitmap.fill(palette[6], 0, previewBitmap.length);
					fonts.drawGlyph(previewBitmap, glyphWidth, glyphHeight, 0, 0, glyphEntry.bitmap, glyphWidth, glyphHeight, palette[1], palette[2]);

					charPreviewCanvas.width = glyphWidth;
					charPreviewCanvas.height = glyphHeight;
					// scale the canvas by an integer amount up to a *width* of 200px (dw about the height)
					const scaling = Math.floor(200 / glyphWidth);
					charPreviewCanvas.style.cssText = `width: ${glyphWidth * scaling}px; height: ${glyphHeight * scaling}px; margin: 0 ${(200 - glyphWidth * scaling) / 2}px`;

					const charPreviewCtx = charPreviewCanvas.getContext('2d');
					charPreviewCtx.putImageData(new ImageData(bufToU8Clamped(previewBitmap), glyphWidth, glyphHeight), 0, 0);

					charPreviewList.innerHTML = '';
					const exportButton = button('Export PNG', () => {
						const pngBitmap = new Uint32Array(glyphWidth * glyphHeight);
						// (bitmap, bitmapWidth, bitmapHeight, bitmapX, bitmapY, glyphBitmap, glyphWidth, glyphHeight, mainColor, altColor) 
						fonts.drawGlyph(pngBitmap, glyphWidth, glyphHeight, 0, 0, glyphEntry.bitmap, glyphWidth, glyphHeight, palette[1], palette[2]);
						const image = png(pngBitmap, glyphWidth, glyphHeight);
						download(`glyph-0x${str8(glyphIndex)}.png`, image, 'image/png');
					});
					charPreviewList.appendChild(exportButton);

					const letterLists = [fonts.latinCharMap, fonts.japaneseCharMap, fonts.japaneseExtendedCharMap, fonts.koreanCharMap, fonts.koreanExtendedCharMap].map(map => {
						const list = charCodes.map(code => {
							if (map[code]) {
								const unicode = map[code].codePointAt(0); // NOT charCodeAt, bc we don't want surrogates
								return `${sanitize(map[code])} <span style="color:var(--fg-dim)">(U+${str16(unicode)})</span>`;
							}
							return '<span style="color:var(--red)">?</span>';
						});
						if (list.length <= 1) return list[0];
						return '<ul>' + list.map(x => '<li>' + x + '</li>') + '</ul>';
					});

					addHTML(charPreviewList, [
						`<div>Letter width: ${glyphEntry.letterWidth}</div>`,
						`<div>Char code: ${charCodes.map(x => '0x' + str8(x)).join(', ')}</div>`,
						`<div>Table 0x${tableIndex.toString(16)}, glyph 0x${glyphIndex.toString(16)}</div>`,
						`<div>Latin: ${letterLists[0]}</div>`,
						`<div>JP: ${letterLists[1]}</div>`,
						`<div>JP Ext.: ${letterLists[2]}</div>`,
						`<div>KO: ${letterLists[3]}</div>`,
						`<div>KO Ext.: ${letterLists[4]}</div>`,
					].join(''));
				};

				if (!selectedEntry) {
					for (let i = 0; i < entries.length; ++i) {
						if (!entries[i].glyphEntry) continue;
						select(i);
						break;
					}
				}

				let hoveringIndex = undefined;
				const hover = index => {
					if (index === hoveringIndex) return;
					// un-outline the old entry
					if (entries[hoveringIndex] !== selectedEntry) outline(hoveringIndex, palette[5]);
					// outline the new entry
					if (entries[index]) outline(index, 0xff000000);
					// ONLY set if there's actually an entry here (no out-of-bounds index) or if we're just de-hovering
					if (entries[index] || index === undefined) hoveringIndex = index;

					reoutlineSelected?.();
				};

				sheetCanvas.addEventListener('mousemove', ev => {
					const tileX = Math.min(Math.floor(ev.offsetX / 2 / (maxGlyphWidth + 3)), 15);
					const tileY = Math.floor(ev.offsetY / 2 / (maxGlyphHeight + 3));
					hover(tileY * 16 + tileX);
				});

				sheetCanvas.addEventListener('mouseleave', () => hover(undefined));
				addEventListener('blur', () => hover(undefined));

				sheetCanvas.addEventListener('mousedown', ev => {
					const tileX = Math.min(Math.floor(ev.offsetX / 2 / (maxGlyphWidth + 3)), 15);
					const tileY = Math.floor(ev.offsetY / 2 / (maxGlyphHeight + 3));
					const index = tileY * 16 + tileX;
					if (entries[index]?.glyphEntry) select(index);
				});

				return sheetCanvas;
			};

			// the following code can dump all replacement characters from the game. you could modify it to dump other
			// stuff, too. don't expect this to work well with the UI on the left, *only* use this to generate a glyph
			// sheet.
			/* let defaultGlyphTable;
			const concatGlyphs = new Map();

			const searchFont = dat => {
				if (!dat?.byteLength) return;
				console.log(dat);
				const parsed = fonts.unpack(dat);

				for (let o = 0; o < parsed.charMap.byteLength; o += 2) {
					const tableIndex = parsed.charMap.getUint8(o);
					const glyphIndex = parsed.charMap.getUint8(o + 1);
					if (tableIndex === 0xff && glyphIndex === 0xff) continue;
					const glyphTable = parsed.glyphTables[tableIndex];
					defaultGlyphTable ??= glyphTable;

					if (glyphTable.glyphWidth !== defaultGlyphTable.glyphWidth) console.warn(`mismatching glyphWidth`);
					else if (glyphTable.glyphHeight !== defaultGlyphTable.glyphHeight) console.warn(`mismatching glyphHeight`);
					else concatGlyphs.set(o >> 1, parsed.glyphTables[tableIndex].glyphs[glyphIndex]);
				}
			};

			const search = table => {
				const segments = unpackSegmentedFile(table, 0, table);
				searchFont(segments[0]);
				// searchFont(segments[2]);
				// searchFont(segments[4]);
			};

			for (let i = 2; i < fsext.fevent.length; i += 3) search(fsext.fevent[i]);
			for (const table of fsext.battle.get('/BAI/BMes_cf.dat')) search(table);
			for (const table of fsext.battle.get('/BAI/BMes_ji.dat')) search(table);
			for (const table of fsext.battle.get('/BAI/BMes_yo.dat')) search(table);
			for (const table of unpackSegmentedFile(fs.get('/MAI/MMes_yo.dat'), 0, fs.get('/MAI/MMes_yo.dat'))) search(table);
			for (const table of unpackSegmentedFile(fs.get('/SAI/SMes_yo.dat'), 0, fs.get('/SAI/SMes_yo.dat'))) search(table);

			search(fs.get('/BDataMiniGame/mfset_MesDat_MiniGame.dat'));
			search(fs.get('/EDataSave/mfset_EMesJig.dat'));
			search(fs.get('/EDataSave/mfset_EMesOutline.dat'));
			search(fs.get('/EDataSave/mfset_EMesPlace.dat'));
			search(fs.get('/EDataSave/mfset_EMesSys.dat'));

			const entries = [];
			let lastIndex = 0;
			for (const key of concatGlyphs.keys()) {
				if (lastIndex < key) lastIndex = key;
			}

			console.log(concatGlyphs);

			for (let i = 0; i <= lastIndex; ++i) {
				const glyphEntry = concatGlyphs.get(i);
				if (!glyphEntry) {
					entries.push({
						glyphTable: defaultGlyphTable, glyphEntry: undefined, tableIndex: 0, glyphIndex: i,
						charCodes: [i],
					});
					continue;
				}

				entries.push({
					glyphTable: defaultGlyphTable, glyphEntry, tableIndex: 0, glyphIndex: i,
					charCodes: [i],
				});
			}

			const td = document.createElement('td');
			const sheetCanvas = sheet(entries, defaultGlyphTable.glyphWidth, defaultGlyphTable.glyphHeight);
			td.appendChild(sheetCanvas);

			const tr = document.createElement('tr');
			tr.appendChild(td);
			table.appendChild(tr); */

			for (const [label, dat] of dats) {
				const tr = document.createElement('tr');
				if (label) addHTML(tr, `<th>${label}</th>`);

				const addGlyphTile = (sheet, sheetWidth, sheetHeight, glyph, glyphWidth, glyphHeight, outerBaseX, outerBaseY, letterWidth) => {
					// each tile has 1px of padding plus a 1px line along the top and left
					for (let y = 0; y < glyphHeight + 4; ++y) {
						const edgeY = y === 0 || y === glyphHeight + 3;
						for (let x = 0; x < glyphWidth + 4; ++x) {
							const edge = edgeY || x === 0 || x === glyphWidth + 3;
							sheet[(outerBaseY + y) * sheetWidth + outerBaseX + x] = palette[edge ? 5 : 6];
						}
					}

					const baseX = outerBaseX + 2;
					const baseY = outerBaseY + 2;
					for (let y = 0; y < glyphHeight; ++y) {
						for (let x = 0; x < glyphWidth; ++x) {
							const pos = (baseY + y) * sheetWidth + baseX + x;
							const cell = glyph[y * glyphWidth + x];
							if (cell === 0b00); // clear=0, color=0 => do nothing
							else if (cell === 0b01) sheet[pos] = 0xff0000ff; // clear=0, color=1 => corruption!!1
							else if (cell === 0b10) sheet[pos] = palette[1]; // clear=1, color=0 => main color
							else if (cell === 0b11) sheet[pos] = palette[1 + 1]; // clear=1, color=1 => alt color
						}
					}

					if (showLetterWidths.checked) {
						const y = outerBaseY + glyphHeight + 2;
						for (let x = 0; x < letterWidth; ++x) {
							sheet[y * sheetWidth + outerBaseX + 2 + x] = palette[0xa]; // orange (bowser's color)
						}
					}
				};

				const td = document.createElement('td');
				const font = fonts.unpack(dat);

				const glyphToCharCodes = new Map();
				for (let o = 0; o < font.charMap.byteLength; o += 2) {
					const tableIndex = font.charMap.getUint8(o);
					const glyphIndex = font.charMap.getUint8(o + 1);
					if (tableIndex === 0xff && glyphIndex === 0xff) continue;

					const list = glyphToCharCodes.get(tableIndex << 8 | glyphIndex);
					if (list) list.push(o / 2);
					else glyphToCharCodes.set(tableIndex << 8 | glyphIndex, [o / 2]);
				}

				if (showCharMap.checked) {
					let maxGlyphWidth = 0;
					let maxGlyphHeight = 0;
					for (const table of font.glyphTables) {
						if (maxGlyphWidth < table.glyphWidth) maxGlyphWidth = table.glyphWidth;
						if (maxGlyphHeight < table.glyphHeight) maxGlyphHeight = table.glyphHeight;
					}

					const entries = [];
					for (let o = 0; o < font.charMap.byteLength; o += 2) {
						const tableIndex = font.charMap.getUint8(o);
						const glyphIndex = font.charMap.getUint8(o + 1);
						if (tableIndex === 0xff && glyphIndex === 0xff) {
							entries.push({
								glyphTable: undefined, glyphEntry: undefined, tableIndex, glyphIndex,
								charCodes: glyphToCharCodes.get(tableIndex << 8 | glyphIndex),
							});
							continue;
						}

						const glyphTable = font.glyphTables[tableIndex];
						const glyphEntry = glyphTable?.glyphs[glyphIndex];
						if (!glyphEntry) {
							entries.push({
								glyphTable: false, glyphEntry: false, tableIndex, glyphIndex,
								charCodes: glyphToCharCodes.get(tableIndex << 8 | glyphIndex),
							});
							continue;
						}

						entries.push({
							glyphTable, glyphEntry, tableIndex, glyphIndex,
							charCodes: glyphToCharCodes.get(tableIndex << 8 | glyphIndex),
						});
					}

					const sheetCanvas = sheet(entries, maxGlyphWidth, maxGlyphHeight);
					td.appendChild(sheetCanvas);
				} else {
					for (let i = 0; i < font.glyphTables.length; ++i) {
						const table = font.glyphTables[i];
						addHTML(td, `<div><code>[${i}]</code> ${table.glyphWidth}x${table.glyphHeight} size, ${table.glyphs.length} glyphs</div>`);

						const entries = [];
						for (let j = 0; j < table.glyphs.length; ++j) {
							entries.push({
								glyphTable: table, glyphEntry: table.glyphs[j], tableIndex: i, glyphIndex: j,
								charCodes: glyphToCharCodes.get(i << 8 | j),
							});
						}

						const sheetCanvas = sheet(entries, table.glyphWidth, table.glyphHeight);
						td.appendChild(sheetCanvas);
					}
				}

				tr.appendChild(td);
				table.appendChild(tr);
			}

			fontPreview.appendChild(table);
		};

		updateFontFileSelection();
		updatePalette();

		return fonts;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Textboxes                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const textboxes = (window.textboxes = createSection('Textboxes', section => {
		const textboxes = {};

		const paletteSelect = dropdown(['Light', 'Dark', 'Pal Row 2', 'Pal Row 3', 'Pal Row 4', 'Pal Row 5'], 0, () => updateStyle());
		section.appendChild(paletteSelect);

		const styleSelect = dropdown(['[0] None', '[1] Bubble', '[2] Shout', '[3] Bulletin'], 1, () => updateStyle());
		section.appendChild(styleSelect);

		const styleRow = document.createElement('div');
		section.appendChild(styleRow);

		let layoutSelect = dropdown([''], 0, () => {});
		styleRow.appendChild(layoutSelect);

		let widthSelectBase = undefined;
		let widthSelect = dropdown([''], 0, () => {});
		styleRow.appendChild(widthSelect);

		let heightSelectBase = undefined;
		let heightSelect = dropdown([''], 0, () => {});
		styleRow.appendChild(heightSelect);

		let updateTextbox;
		const styleSeparateParts = checkbox('Separate Parts', false, () => updateTextbox());
		styleRow.appendChild(styleSeparateParts);

		const styleMetaPreview = document.createElement('div');
		section.appendChild(styleMetaPreview);

		const textboxCanvas = document.createElement('canvas');
		section.appendChild(textboxCanvas);

		textboxes.layout = (style, tileHeight) => {
			const styleOffset = fsext.textboxStyles.getUint32(style * 4, true) - headers.arm9RamOffset;
			for (let o = styleOffset; o < fs.arm9.byteLength; o += 8) {
				const layoutOffset = fs.arm9.getUint32(o, true) - headers.arm9RamOffset;
				const maxHeight = fs.arm9.getUint32(o + 4, true);
				if (tileHeight <= maxHeight) {
					return [sliceDataView(fs.arm9, layoutOffset, layoutOffset + 0x24), maxHeight];
				}

				if (maxHeight === 0xff) return; // this condition will never be reached on a valid ROM
			}
		};

		textboxes.drawBackground = (bitmap, tileWidth, tileHeight, style, palette, sliceSpacing) => {
			const [layout] = textboxes.layout(style, tileHeight);

			const borderSideWidth = layout.getUint16(0, true);
			const borderTopWidth = layout.getUint16(2, true);
			const borderBottomWidth = layout.getUint16(4, true);
			const fill = layout.getUint32(8, true);

			const topLeftOffset = layout.getUint32(0xc, true) - headers.arm9RamOffset;
			const topRightOffset = layout.getUint32(0x10, true) - headers.arm9RamOffset;
			const bottomLeftOffset = layout.getUint32(0x14, true) - headers.arm9RamOffset;
			const bottomRightOffset = layout.getUint32(0x18, true) - headers.arm9RamOffset;
			const tbSidesOffset = layout.getUint32(0x1c, true) - headers.arm9RamOffset;
			const lrSidesOffset = layout.getUint32(0x20, true) - headers.arm9RamOffset;

			const tileset = bufToU8(fsext.textboxTileset);
			const put = (tileIdx, tileX, tileY) => {
				let o = tileIdx * 32;
				for (let y = 0; y < 8; ++y) {
					for (let x = 0; x < 8; x += 2) {
						const composite = tileset[o++];
						const pos = (tileY * 8 + y) * (tileWidth * 8) + (tileX * 8 + x);
						if (composite & 0xf) bitmap[pos] = palette[composite & 0xf];
						if (composite >> 4) bitmap[pos ^ 1] = palette[composite >> 4];
					}
				}
			};

			// #1 - draw top left and top right
			let oLeft = topLeftOffset;
			let oRight = topRightOffset;
			for (let y = 0; y < borderTopWidth; ++y) {
				for (let x = 0; x < borderSideWidth; ++x) {
					put(fs.arm9.getUint16(oLeft, true) >> 3, x, y);
					put(fs.arm9.getUint16(oRight, true) >> 3, tileWidth - borderSideWidth + x, y);
					oLeft += 2;
					oRight += 2;
				}
			}

			// #2 - draw bottom left and bottom right
			oLeft = bottomLeftOffset;
			oRight = bottomRightOffset;
			for (let y = 0; y < borderBottomWidth; ++y) {
				for (let x = 0; x < borderSideWidth; ++x) {
					put(fs.arm9.getUint16(oLeft, true) >> 3, x, tileHeight - borderBottomWidth + y);
					put(fs.arm9.getUint16(oRight, true) >> 3, tileWidth - borderSideWidth + x, tileHeight - borderBottomWidth + y);
					oLeft += 2;
					oRight += 2;
				}
			}

			// #3 - draw top and bottom sides
			const pad = sliceSpacing ? 1 : 0;
			for (let x = borderSideWidth + pad; x < tileWidth - borderSideWidth - pad; ++x) {
				let o = tbSidesOffset + 2;
				for (let y = 0; y < borderTopWidth; ++y) {
					put(fs.arm9.getUint16(o, true) >> 3, x, y);
					o += 2;
				}

				for (let y = 0; y < borderBottomWidth; ++y) {
					put(fs.arm9.getUint16(o, true) >> 3, x, tileHeight - borderBottomWidth + y);
					o += 2;
				}
			}

			// #4 - draw left and right sides
			for (let y = borderTopWidth + pad; y < tileHeight - borderBottomWidth - pad; ++y) {
				let o = lrSidesOffset + 2;
				for (let x = 0; x < borderSideWidth; ++x) {
					put(fs.arm9.getUint16(o, true) >> 3, x, y);
					o += 2;
				}

				for (let x = 0; x < borderSideWidth; ++x) {
					put(fs.arm9.getUint16(o, true) >> 3, tileWidth - borderSideWidth + x, y);
					o += 2;
				}
			}

			// #5 - fill center
			for (let tileY = borderTopWidth + pad; tileY < tileHeight - borderBottomWidth - pad; ++tileY) {
				for (let tileX = borderSideWidth + pad; tileX < tileWidth - borderSideWidth - pad; ++tileX) {
					for (let y = 0; y < 8; ++y) {
						for (let x = 0; x < 8; ++x) {
							const pos = (tileY * 8 + y) * (tileWidth * 8) + (tileX * 8 + x);
							const index = (fill >>> (x * 4)) & 0xf;
							bitmap[pos] = palette[index];
						}
					}
				}
			}
		};

		let updateTable;
		const updateStyle = () => {
			styleMetaPreview.innerHTML = '';
			const styleOffset = fsext.textboxStyles.getUint32(styleSelect.value * 4, true) - headers.arm9RamOffset;

			const layoutOptions = [];
			for (let i = 0, o = styleOffset; o < fs.arm9.byteLength; ++i, o += 8) {
				const layoutOffset = fs.arm9.getUint32(o, true) - headers.arm9RamOffset;
				const maxHeight = fs.arm9.getUint8(o + 4);

				layoutOptions.push(`Layout ${i}, max height 0x${maxHeight.toString(16)}`);

				if (maxHeight === 0xff) break;
			}

			const newLayoutDropdown = dropdown(layoutOptions, 0, () => updateLayout());
			layoutSelect.replaceWith(newLayoutDropdown);
			layoutSelect = newLayoutDropdown;

			const updateLayout = () => {
				const layoutOffset = fs.arm9.getUint32(styleOffset + layoutSelect.value * 8, true) - headers.arm9RamOffset;
				const maxHeight = fs.arm9.getUint32(styleOffset + layoutSelect.value * 8 + 4, true);
				const borderSideWidth = fs.arm9.getUint16(layoutOffset, true);
				const borderTopWidth = fs.arm9.getUint16(layoutOffset + 2, true);
				const borderBottomWidth = fs.arm9.getUint16(layoutOffset + 4, true);
				const fill = fs.arm9.getUint32(layoutOffset + 8, true);
				const tbSidesOffset = fs.arm9.getUint32(layoutOffset + 0x1c, true) - headers.arm9RamOffset;
				const lrSidesOffset = fs.arm9.getUint32(layoutOffset + 0x20, true) - headers.arm9RamOffset;

				styleMetaPreview.innerHTML = `borderSideWidth = ${borderSideWidth}, borderTopWidth = ${borderTopWidth}, borderBottomWidth = ${borderBottomWidth}, fill = 0x${str32(fill)}`;

				if (tbSidesOffset >= 0) {
					addHTML(styleMetaPreview, `, verticalUnknown = ${fs.arm9.getUint16(tbSidesOffset, true)}`);
				} else {
					addHTML(styleMetaPreview, ', verticalUnknown = N/A');
				}

				if (lrSidesOffset >= 0) {
					addHTML(styleMetaPreview, `, horizontalUnknown = ${fs.arm9.getUint16(lrSidesOffset, true)}`);
				} else {
					addHTML(styleMetaPreview, ', horizontalUnknown = N/A');
				}

				const newWidthBase = borderSideWidth * 2;
				const widthOptions = [];
				for (let x = newWidthBase; x <= 32; ++x) widthOptions.push(`w = ${x} tiles`);

				const oldWidth = widthSelectBase === undefined ? 5 : (widthSelect.value + widthSelectBase);
				const initialWidthOption = Math.min(Math.max(oldWidth - newWidthBase, 0), widthOptions.length - 1);
				const newWidthDropdown = dropdown(widthOptions, initialWidthOption, () => updateTextbox());
				widthSelect.replaceWith(newWidthDropdown);
				widthSelect = newWidthDropdown;
				widthSelectBase = newWidthBase;

				const newHeightBase = borderTopWidth + borderBottomWidth;
				const heightOptions = [];
				for (let y = borderTopWidth + borderBottomWidth; y <= Math.min(maxHeight, 24); ++y) {
					heightOptions.push(`h = ${y} tiles`);
				}

				const oldHeight = heightSelectBase === undefined ? 5 : (heightSelect.value + heightSelectBase);
				const initialHeightOption = Math.min(Math.max(oldHeight - newHeightBase, 0), heightOptions.length - 1);
				const newHeightDropdown = dropdown(heightOptions, initialHeightOption, () => updateTextbox());
				heightSelect.replaceWith(newHeightDropdown);
				heightSelect = newHeightDropdown;
				heightSelectBase = newHeightBase;

				updateTextbox = () => {
					const padding = styleSeparateParts.checked ? 1 : 0;
					let tileWidth = widthSelect.value + widthSelectBase + padding * 2;
					let tileHeight = heightSelect.value + heightSelectBase + padding * 2;

					const bitmapWidth = tileWidth * 8;
					const bitmapHeight = tileHeight * 8;
					const bitmap = new Uint32Array(bitmapWidth * bitmapHeight);

					const paletteO = paletteSelect.value * 64;
					const palette = bufToU32(sliceDataView(bufToDat(fonts.palette), paletteO, paletteO + 64));
					textboxes.drawBackground(bitmap, tileWidth, tileHeight, styleSelect.value, palette, styleSeparateParts.checked);

					textboxCanvas.width = bitmapWidth;
					textboxCanvas.height = bitmapHeight;
					textboxCanvas.style.cssText = `width: ${bitmapWidth * 2}px; height: ${bitmapHeight * 2}px`;
					const ctx = textboxCanvas.getContext('2d');
					ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), bitmapWidth, bitmapHeight), 0, 0);
				};
				updateTextbox();
			};
			updateLayout();
			updateTable?.();
		};
		updateStyle();

		textboxes.stringifySimple = (buf, characterMap, altCharacterMap) => {
			const u8 = bufToU8(buf);
			const line = [];

			for (let o = 0; o < u8.length;) {
				const char = u8[o++];
				if (char === 0) break;
				else if (char === 0x20) line.push(' ');
				else if (char === 0xff) {
					const ctrl = u8[o++];
					if (ctrl === 0) line.push('\n');
					else if (ctrl === 1 || ctrl === 0xb || ctrl === 0xc || ctrl === 0x11) ++o;
					else if (ctrl === 0xf || ctrl === 0x10) {
						const reg = 0xc000 | u8[o++];
						++o; // skip digits
						line.push(`(reg_${str16(reg)})`);
					}
				} else if (altCharacterMap && 0xfa <= char) {
					const charExt = (0xfe - char) << 8 | u8[o++];
					line.push(altCharacterMap[charExt] ?? '?');
				} else {
					line.push(characterMap[char] ?? '?');
				}
			}

			return line.join('');
		};

		textboxes.stringify = (buffer, characterMap, altCharacterMap) => {
			const u8 = bufToU8(buffer);
			const lines = [];
			const currentLine = [];
			let currentLineIsControl = undefined;

			const push = (label, isControl) => {
				if (!isControl === currentLineIsControl && currentLine.length) {
					// note: does not happen if currentLineIsControl is undefined
					lines.push(currentLine.join(''));
					currentLine.length = 0;
				}

				currentLineIsControl = isControl;
				if (isControl) label = `<span style="color:var(--blue)">&lt;${label}&gt;</span>`;
				currentLine.push(label);
			};

			let o = 0;
			for (; o < u8.length;) {
				const char = u8[o++];
				if (char === 0) break;

				if (char === 0x20) {
					// space character
					push(' ', false);
					continue;
				}

				if (char === 0xff) {
					const control = u8[o++];
					if (control === 0) {
						// line break
						lines.push(currentLine.join(''));
						currentLine.length = 0;
					} else if (1 <= control && control <= 0x1f) {
						if (control === 1) push(`clear(${u8[o++]})`, true);
						else if (control === 3) push('fast', true);
						else if (control === 4) push('choice', true);
						else if (control === 0xa) push('close', true);
						else if (control === 0xb) {
							const alignId = u8[o++];
							const alignment = ['top', 'middle', 'bottom'][alignId] ?? alignId;
							push(`valign(${alignment})`, true);
						} else if (control === 0xc) push(`wait(${u8[o++]})`, true);
						else if (control === 0xf) {
							const reg = u8[o++] | 0xc000;
							const digits = u8[o++];
							push(`register(reg_${str16(reg)}, ${digits} digits)`, true);
						} else if (control === 0x10) {
							const reg = u8[o++] | 0xc000;
							const digits = u8[o++];
							push(`registerPadded(reg_${str16(reg)}, ${digits} digits)`, true);
						} else if (control === 0x11) push(`prompt(${u8[o++]})`, true);
						else if (control === 0x14) push('group', true);
						else if (control === 0x15) push('ungroup', true);
						else {
							push(str8(control), true);
						}
					} else if (0x20 <= control && control <= 0x2f) {
						// set palette offset
						let color = control & 0xf;
						if (color === 0) color = 'reset';
						else if (color === 7) color = 'green';
						else if (color === 9) color = 'orange';
						else if (color === 11) color = 'blue';
						else if (color === 13) color = 'red';
						// other colors are invalid but do work

						push(`color(${color})`, true);
					} else if (0x30 <= control && control <= 0x3f) {
						// set text alignment and size
						if (control === 0x30) push('stretchReset', true);
						else if (control === 0x31) push('stretchH', true);
						else if (control === 0x32) push('stretchV', true);
						else if (control === 0x33) push('stretchHV', true);
						else if (control === 0x34) push('halign(left)', true);
						else if (control === 0x35) push('halign(middle)', true);
						else if (control === 0x36) push('halign(right)', true);
						else if (control === 0x37) push('monospace(0)', true);
						else if (control === 0x38) push('monospace(1)', true);
					} else if (0x40 <= control && control <= 0x4f) {
						// set font
						push(`font(${control & 0xf})`, true);
					} else if (0x50 <= control && control <= 0x5f) {
						// set space width
						push(`spaceWidth(${control & 0xf})`, true);
					} else if (0x60 <= control && control <= 0x7f) {
						// increment printer X
						push(`x += ${control & 0x1f}`, true);
					} else if (0x80 <= control && control <= 0x9f) {
						// decrement printer X
						push(`x -= ${control & 0x1f}`, true);
					} else if (0xa0 <= control && control <= 0xbf) {
						// increment printer Y
						push(`y += ${control & 0x1f}`, true);
					} else if (0xc0 <= control && control <= 0xdf) {
						// decrement printer Y
						push(`y -= ${control & 0x1f}`, true);
					} else if (0xe0 <= control && control <= 0xef) {
						// set text kerning
						if (0xe0 <= control && control <= 0xe7) {
							push(`setDefaultKerning(${control & 7})`, true);
						} else if (0xe8 <= control && control <= 0xee) {
							push(`kerning(${control & 7})`, true);
						} else {
							// control == 0xef
							push('resetKerning', true);
						}
					}
				} else if (altCharacterMap && 0xfa <= char) {
					const mod = u8[o++];
					const rCharCode = ((0xfe - char) << 8) | mod;
					const mapped = altCharacterMap[rCharCode];
					if (mapped !== undefined) push(mapped, false);
					else push(`<span style="color:var(--red)">\\x${str8(char)}\\x${str8(mod)}</span>`, false);
				} else {
					const mapped = characterMap[char];
					if (mapped !== undefined) push(mapped, false);
					else push(`<span style="color:var(--red)">\\x${str8(char)}</span>`, false);
				}
			}

			if (currentLine.length) lines.push(currentLine.join(''));
			return lines;
		};

		textboxes.render = (dat, style, palette, fontList, contentWidth, contentHeight, isLatin) => {
			let contentLeft = 0;
			let contentTop = 0;
			let textboxWidth, textboxHeight; // calculated later

			contentWidth *= 8; // in messages, these are stored in tiles, but they should measure pixels here
			contentHeight *= 8;

			const calcLineLength = printer => {
				const subPrinter = { ...printer, choices: [] };
				for (; subPrinter.o < dat.byteLength;) {
					const c1 = dat.getUint8(subPrinter.o);
					if (c1 === 0) break;
					if (c1 === 0xff) {
						const c2 = dat.getUint8(subPrinter.o + 1);
						if (c2 === 0x00 || c2 === 0x01) break;
					}

					printChar(subPrinter, undefined, true);
				}

				return subPrinter.x - printer.x;
			};

			const calcPageBoundingBox = (printer, multiplePages) => {
				const subPrinter = { ...printer, x: 0, y: 0, boundingX: 0, boundingY: 0, choices: [] };
				for (; subPrinter.o < dat.byteLength;) {
					const c1 = dat.getUint8(subPrinter.o);
					if (c1 === 0) break;
					if (!multiplePages && c1 === 0xff) {
						const c2 = dat.getUint8(subPrinter.o + 1);
						if (c2 === 0x01) break;
					}

					printChar(subPrinter, undefined, true);
				}

				return { x: subPrinter.boundingX, y: subPrinter.boundingY };
			};

			// printer: {
			//    boundingX, boundingY, choices, defaultKerningX, doubleX, doubleY, fontIndex, horizontalAlignment, kerningX, kerningY, lineHeight, lines, maxLines, o, pageHeight, spaceWidth, x, y
			// }
			const printChar = (printer, bitmap, simple) => {
				const char = dat.getUint8(printer.o++);
				if (char === 0x20) {
					printer.x += printer.spaceWidth + printer.kerningX;

					const { glyphHeight } = fontList[printer.fontIndex * 2].glyphTables[0];
					if (glyphHeight < printer.lineHeight) printer.lineHeight = glyphHeight;
				} else if (char === 0xff) {
					// control
					const control = dat.getUint8(printer.o++);
					if (control === 0) {
						// new line
						printer.x = contentLeft;
						if (!simple) {
							if (printer.horizontalAlignment === 1) {
								printer.x = (contentWidth - calcLineLength(printer)) >> 1;
							} else if (printer.horizontalAlignment === 2) {
								printer.x = contentWidth - contentLeft - calcLineLength(printer);
							}
						}

						printer.y += printer.lineHeight + printer.kerningY;
						printer.lineHeight = 0;
						if (printer.maxLines < ++printer.lines) printer.maxLines = printer.lines;
					} else if (1 <= control && control <= 0x1f) {
						if (control === 1) {
							// reset text (next page)
							++printer.o; // void
							if (!simple) {
								printer.x = contentLeft;
								printer.horizontalAlignment = 0;
								printer.lineHeight = 0;
								printer.lines = 0;
								printer.pageHeight = calcPageBoundingBox(printer, false).y;
								printer.y = (textboxHeight * 8 - printer.pageHeight) >> 1; // center aligned
							}
						} else if (control === 4) {
							// choice
							if (!simple) printer.choices.push({ x: printer.x, y: printer.y });
						} else if (control === 0xa) {
							// close
							return;
						} else if (control === 0xb) {
							// vertical alignment
							const alignment = dat.getUint8(printer.o++);
							if (!simple) {
								if (alignment === 0) printer.y = contentTop;
								else if (alignment === 1) printer.y = ((textboxHeight) * 8 - printer.pageHeight) >> 1;
								else if (alignment === 2) printer.y = (textboxHeight + 2) * 8 - printer.pageHeight - 1;
							}
						} else if (control === 0xc) {
							++printer.o; // void
						} else if (control === 0xf || control === 0x10) {
							// register display: display a bunch of N's, as a hack
							++printer.o; // don't display index
							const digits = dat.getUint8(printer.o);
							dat.setUint8(printer.o, 'N'.charCodeAt(0));
							for (let i = 0; i < digits; ++i) {
								printChar(printer, bitmap, simple);
								--printer.o;
							}

							dat.setUint8(printer.o++, digits); // restore
						} else if (control === 0x11) {
							// prompt: TODO
							++printer.o; // void
						}
					} else if (0x20 <= control && control <= 0x2f) {
						// set palette offset
						if (!simple) printer.paletteIndex = control & 0xf;
					} else if (0x30 <= control && control <= 0x3f) {
						// set text alignment and size
						if (control <= 0x33) {
							printer.doubleX = !!(control & 1);
							printer.doubleY = !!(control & 2);
						} else if (control <= 0x36) {
							if (!simple && control === 0x34) {
								printer.horizontalAlignment = 0;
							} else if (!simple && control === 0x35) {
								printer.horizontalAlignment = 1;
								printer.x = (contentWidth - calcLineLength(printer)) >> 1;
							} else if (!simple && control === 0x36) {
								printer.horizontalAlignment = 2;
								printer.x = contentWidth - contentLeft - calcLineLength(printer);
							}
						} else if (control === 0x37) printer.monospace = false;
						else if (control === 0x38) printer.monospace = true;
					} else if (0x40 <= control && control <= 0x4f) {
						// set font
						printer.fontIndex = control & 0xf;
					} else if (0x50 <= control && control <= 0x5f) {
						// set space width
						printer.spaceWidth = control & 0xf;
					} else if (0x60 <= control && control <= 0x7f) {
						printer.x += control & 0x1f;
					} else if (0x80 <= control && control <= 0x9f) {
						printer.x -= control & 0x1f;
					} else if (0xa0 <= control && control <= 0xbf) {
						printer.y += control & 0x1f;
					} else if (0xc0 <= control && control <= 0xdf) {
						printer.y -= control & 0x1f;
					} else if (0xe0 <= control && control <= 0xef) {
						if (control <= 0xe7) {
							printer.defaultKerningX = printer.kerningX = control & 7;
						} else if (control <= 0xee) {
							printer.kerningX = control & 7;
						} else {
							printer.kerningX = printer.defaultKerningX;
						}
					}
				} else {
					let font = fontList[printer.fontIndex * 2];
					let charCode = char;
					if (!isLatin && 0xfa <= char) {
						// replacement char
						font = fontList[printer.fontIndex * 2 + 1];
						charCode = ((0xfe - char) << 8) | dat.getUint8(printer.o++);
					}

					const tableIndex = font.charMap.getUint8(charCode * 2);
					const glyphIndex = font.charMap.getUint8(charCode * 2 + 1);
					const glyphTable = font.glyphTables[tableIndex];
					const glyphEntry = glyphTable.glyphs[glyphIndex];
					const { glyphWidth, glyphHeight } = glyphTable;
					if (bitmap) {
						fonts.drawGlyph(bitmap, textboxWidth * 8, textboxWidth * 8, printer.x, printer.y, glyphEntry.bitmap, glyphWidth, glyphHeight, palette[(printer.paletteIndex + 1) & 0xf], palette[(printer.paletteIndex + 2) & 0xf]);
					}

					if (printer.monospace) printer.x += glyphWidth + printer.kerningX;
					else printer.x += glyphEntry.letterWidth + printer.kerningX;

					if (printer.lineHeight < glyphHeight) printer.lineHeight = glyphHeight;

					if (printer.boundingX < printer.x) printer.boundingX = printer.x;
					if (printer.boundingY < printer.y + printer.lineHeight) printer.boundingY = printer.y + printer.lineHeight; // TODO: isn't this unconditional?!
				}
			};

			// find content bounds
			const printer = {
				boundingX: 0,
				boundingY: 0,
				choices: [],
				defaultKerningX: isLatin ? 1 : 2,
				doubleX: false,
				doubleY: false,
				fontIndex: 0,
				horizontalAlignment: 0,
				kerningX: isLatin ? 1 : 2,
				kerningY: isLatin ? 1 : 3,
				lineHeight: 0,
				lines: 0,
				maxLines: 0,
				o: 0,
				pageHeight: 0,
				paletteIndex: 0,
				spaceWidth: 6,
				x: 0,
				y: 0,
			};

			// #1 : if content size is not specified, infer it from the text bounding box
			if (!contentWidth || !contentHeight) {
				// NOTE: automatic textbox sizes *should* be one page only
				const boundingBox = calcPageBoundingBox(printer, true);
				// i'm not sure why the game checks x & 1 instead of x & 7
				contentWidth = (boundingBox.x + 0x18 + ((boundingBox.x & 1) << 3));
				contentHeight = (boundingBox.y + 0x10 + ((boundingBox.y & 1) << 3));
			}

			// #3 : fix textbox size to be a minimum
			const [layout, layoutMaxHeight] = textboxes.layout(style, contentHeight >> 3);
			const borderSideWidth = layout.getUint16(0, true);
			const borderTopWidth = layout.getUint16(2, true);
			const borderBottomWidth = layout.getUint16(4, true);

			if (style === 2) contentWidth += 8;
			textboxWidth = contentWidth >> 3;
			textboxWidth = Math.max(textboxWidth, borderSideWidth * 2 + 1);

			textboxHeight = contentHeight >> 3;
			let minTextboxHeight = borderTopWidth + borderBottomWidth;
			if (layoutMaxHeight === 0xff) ++minTextboxHeight;
			textboxHeight = Math.max(textboxHeight, minTextboxHeight);

			// #4 : set content start
			contentLeft = borderSideWidth * 4;
			contentTop = borderTopWidth * 4;
			if (style) {
				contentLeft += 4;
				contentTop += 2;
			}

			printer.x = contentLeft;
			printer.pageHeight = calcPageBoundingBox(printer, false).y;
			// in the JP release, text is top-aligned. in every other release, text is center-aligned.
			if (headers.gamecode === 'CLJJ') printer.y = contentTop;
			else printer.y = (textboxHeight * 8 - printer.pageHeight) >> 1;

			// #5 : go render now
			const bitmaps = [];
			let bitmap;
			for (; printer.o < dat.byteLength;) {
				const c1 = dat.getUint8(printer.o);
				const c2 = printer.o + 1 < dat.byteLength ? dat.getUint8(printer.o + 1) : -1;

				if (c1 === 0) break;
				if (!bitmap) {
					bitmap = new Uint32Array(textboxWidth * 8 * textboxHeight * 8);
					if (style) textboxes.drawBackground(bitmap, textboxWidth, textboxHeight, style, palette, false);
				}

				printChar(printer, bitmap, false);
				if (c1 === 0xff && c2 === 0x1) {
					// reset textbox (next page)
					bitmaps.push(bitmap);
					bitmap = undefined;
				}
			}

			if (bitmap) bitmaps.push(bitmap);
			return { bitmaps, textboxWidth, textboxHeight };
		};

		// [filePath, multipleTables, includesSize, includesFonts]
		const fileOptions = [
			['/FEvent/FEvent.dat', true, true, true],
			['/BAI/BMes_cf.dat', true, true, true],
			['/BAI/BMes_ji.dat', true, true, true],
			['/BAI/BMes_yo.dat', true, true, true],
			['/MAI/MMes_yo.dat', true, true, true],
			['/SAI/SMes_yo.dat', true, true, true],
			['/BData/mfset_AItmC.dat', false, false, false], // PIT only?
			['/BData/mfset_AItmE.dat', false, false, false],
			['/BData/mfset_AItmE2.dat', false, false, false],
			['/BData/mfset_AItmN.dat', false, false, false],
			['/BData/mfset_BadgeE.dat', false, false, false],
			['/BData/mfset_BadgeEffectE.dat', false, false, false],
			['/BData/mfset_BadgeN.dat', false, false, false],
			['/BData/mfset_BonusE.dat', false, false, false],
			['/BData/mfset_Help.dat', false, false, false],
			['/BData/mfset_MiniGame.dat', false, false, false],
			['/BData/mfset_MonN.dat', false, false, false],
			['/BData/mfset_RankUpE.dat', false, false, false],
			['/BData/mfset_UItmE.dat', false, false, false],
			['/BData/mfset_UItmE2.dat', false, false, false],
			['/BData/mfset_UItmN.dat', false, false, false],
			['/BData/mfset_WearE.dat', false, false, false],
			['/BData/mfset_WearN.dat', false, false, false],
			['/BDataMiniGame/mfset_MesDat_MiniGame.dat', false, true, true],
			['/EDataSave/mfset_EMesJig.dat', false, true, true],
			['/EDataSave/mfset_EMesOutline.dat', false, true, true],
			['/EDataSave/mfset_EMesPlace.dat', false, true, true],
			['/EDataSave/mfset_EMesSys.dat', false, true, true],
			['/MData/mfset_InitLoadMes.dat', false, true, false],
			['/MData/mfset_MenuMes.dat', false, false, false],
			['/MData/mfset_ParamExpMes.dat', false, true, false],
			['/MData/mfset_ShopMes.dat', false, true, false],
		];

		const optionsRow = document.createElement('div');
		section.appendChild(optionsRow);

		const fileSelect = dropdown(fileOptions.map(x => x[0]), 0, () => updateFile());
		optionsRow.appendChild(fileSelect);

		let tableOptions = [];
		let tableSelect = dropdown([''], 0, () => {});
		optionsRow.appendChild(tableSelect);

		const renderTextboxes = checkbox('Render Textboxes', false, () => updateTable());
		optionsRow.appendChild(renderTextboxes);

		const doubleScale = checkbox('2x Scale', false, () => updateTable());
		doubleScale.style.display = 'none';
		optionsRow.appendChild(doubleScale);

		const smallFont = checkbox('Small Font', false, () => updateTable());
		smallFont.style.display = 'none';
		optionsRow.appendChild(smallFont);

		const tablePreview = document.createElement('table');
		tablePreview.className = 'bordered';
		section.appendChild(tablePreview);

		const unpackedMediumFont = fonts.unpack(fsext.font);
		const unpackedSmallFont = fonts.unpack(fsext.smallFont);
		const unpackedSmallFontExt = fsext.smallFontExt && fonts.unpack(fsext.smallFontExt);

		updateTable = () => {
			doubleScale.style.display = renderTextboxes.checked ? 'inline-block' : 'none';
			smallFont.style.display = renderTextboxes.checked ? 'inline-block' : 'none';

			const [_path, _multipleTables, includesSize, includesFonts] = fileOptions[fileSelect.value];
			const table = tableOptions[tableSelect.value]?.[1];
			tablePreview.innerHTML = '';
			if (!table) {
				// possible if this file doesn't have any tables available (but probably impossible in a real MLBIS rom)
				return;
			}

			const columns = unpackSegmentedFile(table, 0, table);
			const filteredColumns = [];
			let maxRows = 0;
			for (let i = includesFonts ? 66 : 0; i < columns.length; ++i) {
				const unpacked = unpackSegmented32(columns[i]);
				if (!unpacked.length) continue;
				if (maxRows < unpacked.length) maxRows = unpacked.length;
				filteredColumns.push([i, unpacked]);
			}

			const baseFont = fonts.unpack(fsext.font);
			const fontColumns = new Map();
			if (includesFonts) {
				for (let i = 0; i < 35; ++i) {
					if (!columns[i].byteLength) continue;
					fontColumns.set(i, fonts.unpack(columns[i]));
				}
			}

			if (maxRows === 0 || !filteredColumns.length) {
				tablePreview.innerHTML = '<tr><th>(empty)</th></tr>';
				return;
			}

			const headerRow = document.createElement('tr');
			addHTML(headerRow, '<th></th>');
			for (const [idx] of filteredColumns) {
				if (includesFonts) addHTML(headerRow, `<th>[${idx}] ${fonts.languageNamesWithFonts[idx]}</th>`);
				else addHTML(headerRow, `<th>[${idx}] ${fonts.languageNames[idx]}</th>`);
			}

			tablePreview.appendChild(headerRow);

			for (let row = 0; row < maxRows; ++row) {
				const tr = document.createElement('tr');
				addHTML(tr, `<th>[${row}]</th>`);

				for (let i = 0; i < filteredColumns.length; ++i) {
					const td = document.createElement('td');

					let dat = filteredColumns[i][1][row];
					if (!dat?.byteLength) {
						tr.appendChild(td);
						continue;
					}

					let contentWidth = 0;
					let contentHeight = 0;
					if (includesSize) {
						contentWidth = dat.getUint8(0) + 1;
						contentHeight = dat.getUint8(1) + 1;
						dat = sliceDataView(dat, 2, dat.byteLength);
					}

					const language = includesFonts ? (filteredColumns[i][0] - 66) : filteredColumns[i][0];
					if (renderTextboxes.checked) {
						// graphical
						const fontList = [];
						if (smallFont.checked) {
							fontList[0] = unpackedSmallFont;
							fontList[1] = unpackedSmallFontExt;
						} else {
							fontList[0] = unpackedMediumFont;
						}

						if (includesFonts) {
							fontList[1] = fontColumns.get(language * 5); // replacement
							fontList[2] = fontColumns.get(language * 5 + 1); // small
							fontList[3] = fontColumns.get(language * 5 + 2); // small replacement
							fontList[4] = fontColumns.get(language * 5 + 3); // big
							fontList[5] = fontColumns.get(language * 5 + 4); // big replacement
						}

						const paletteO = paletteSelect.value * 64;
						const palette = bufToU32(sliceDataView(bufToDat(fonts.palette), paletteO, paletteO + 64));
						const out = textboxes.render(dat, styleSelect.value, palette, fontList, contentWidth, contentHeight, language !== 0);

						const scale = doubleScale.checked ? 2 : 1;
						for (const bitmap of out.bitmaps) {
							const canvas = document.createElement('canvas');
							canvas.width = out.textboxWidth * 8;
							canvas.height = out.textboxHeight * 8;
							canvas.style.cssText = `width: ${canvas.width * scale}px; height: ${canvas.height * scale}px`;

							const ctx = canvas.getContext('2d');
							ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), canvas.width, canvas.height), 0, 0);

							td.appendChild(canvas);
						}
					} else {
						// textual
						const [characterMap, altCharacterMap] = fonts.pickCharMaps(language);
						const lines = textboxes.stringify(dat, characterMap, altCharacterMap);
						let prefix = '';
						if (includesSize) {
							prefix = `<span style="color:var(--green)">&lt;${contentWidth}x${contentHeight}&gt;</span><br>`;
						}

						td.innerHTML = prefix + lines.join('<br>');
					}

					tr.appendChild(td);
				}

				tablePreview.appendChild(tr);
			}
		};

		const updateFile = () => {
			const [path, multipleTables, _includesSize, _includesFonts] = fileOptions[fileSelect.value];

			tableOptions = [];
			if (multipleTables) {
				let segments;
				if (path === '/FEvent/FEvent.dat') segments = fsext.fevent;
				else if (path.startsWith('/BAI/')) segments = fsext.battle.get(path);
				else segments = unpackSegmentedFile(fs.get(path), 0, fs.get(path));

				if (path === '/FEvent/FEvent.dat') {
					for (let i = 2, roomId = 0; i < segments.length; i += 3, ++roomId) {
						if (!segments[i].byteLength) continue;
						tableOptions.push([`Room 0x${roomId.toString(16)}`, segments[i]]);
					}
				} else {
					for (let i = 0; i < segments.length; ++i) {
						if (!segments[i].byteLength) continue;
						tableOptions.push([`Table 0x${i.toString(16)}`, segments[i]]);
					}
				}
			} else {
				tableOptions.push(['', fs.get(path)]);
			}

			if (tableOptions.length) {
				const newTableSelect = dropdown(tableOptions.map(x => x[0]), 0, () => updateTable());
				tableSelect.replaceWith(newTableSelect);
				tableSelect = newTableSelect;
				updateTable();
			} else {
				tableSelect.style.display = 'none';
				tableSelect.select(0, true);
				updateTable();
			}
		};
		updateFile();

		return textboxes;
	}));
};
