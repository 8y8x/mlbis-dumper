'use strict';

window.initBai = () => {
	const shiftJisDecoder = new TextDecoder('shift_jis');

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Battle Scripts                                                                                       |
	// +---------------------------------------------------------------------------------------------------------------+

	const bai = (window.bai = createSection('Battle Scripts', section => {
		const bai = {};

		// preprocess dialect
		bai.dialect = [];
		for (const block of fsext.baiCommands) {
			const argc = block.getUint8(0);
			const args = [];
			for (let i = 0; i < (argc & 0x7f); ++i) {
				const type = i & 1 ? block.getUint8(1 + (i >> 1)) >> 4 : block.getUint8(1 + (i >> 1)) & 0xf;
				args.push(type);
			}

			bai.dialect.push({ returns: !!(argc & 0x80), args });
		}

		const topbar = document.createElement('div');
		topbar.style.cssText = 'position: sticky; top: 0; z-index: 5; background: var(--bg);';
		section.appendChild(topbar);

		const options = [
			['/BAI/BAI_atk_hk.dat', 0xd000],
			// this file is not referenced in overlays, and has no IDs assigned to it
			['/BAI/BAI_atk_mt.dat', undefined],
			['/BAI/BAI_atk_nh.dat', 0xa000],
			['/BAI/BAI_atk_yy.dat', 0xc000],
			['/BAI/BAI_item_ji.dat', 0x5000,],
			['/BAI/BAI_mon_cf.dat', 0x7000],
			['/BAI/BAI_mon_ji.dat', 0x4000],
			['/BAI/BAI_mon_yo.dat', 0x2000],
			['/BAI/BAI_scn_cf.dat', 0x6000],
			['/BAI/BAI_scn_ji.dat', 0x3000],
			['/BAI/BAI_scn_yo.dat', 0x1000],
		];
		const fileSelect = dropdown(
			options.map(entry => `<code>${entry[1] ? str16(entry[1]) : '????'}</code> ${entry[0]}`),
			0,
			() => update(),
		);
		topbar.appendChild(fileSelect);

		const scriptSelectNames = options.map(entry => {
			const segments = fsext.battle.get(entry[0]);
			if (!segments?.length) return ['(?)'];
			return segments.map((x, i) => `<code>${str16(entry[1])}</code> ${i}. (0x${i.toString(16)}) (len 0x${x.byteLength.toString(16)})`);
		});

		let updateScript;
		let scriptSelect = dropdown([''], 0, () => updateScript());
		topbar.appendChild(scriptSelect);

		let updateDisplay;
		const useCustomNames = checkbox('Custom Names', true, () => updateDisplay());
		topbar.appendChild(useCustomNames);

		const refScanButton = button('Scan for References', () => {
			bai.scan();
			refScanButton.remove();
			update();
		});
		topbar.appendChild(refScanButton);

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		const codePreview = document.createElement('div');
		codePreview.style.cssText = 'color: var(--overlay1); font-family: "Red Hat Mono"';
		section.appendChild(codePreview);

		bai.compare = (operator, left, right, opDecorate) => {
			if (operator === 0) return `${left} ${opDecorate('==')} ${right}`;
			if (operator === 1) return `${left} ${opDecorate('!=')} ${right}`;
			if (operator === 2) return `${left} ${opDecorate('<')} ${right}`;
			if (operator === 3) return `${left} ${opDecorate('>')} ${right}`;
			if (operator === 4) return `${left} ${opDecorate('<=')} ${right}`;
			if (operator === 5) return `${left} ${opDecorate('>=')} ${right}`;
			if (operator === 6) return `${left} ${opDecorate('&')} ${right}`;
			if (operator === 7) return `${left} ${opDecorate('|')} ${right}`;
			if (operator === 8) return `${left} ${opDecorate('^')} ${right}`;
			if (operator === 9) return `${opDecorate('!')}${left}`;
			if (operator === 10) return `${opDecorate('~')}${left}`;
		};

		bai.isValidRegister = id => {
			const scope = id >> 12;
			const idx = id & 0xfff;
			if (scope === 1) return idx < 8;
			if (scope === 2) return idx < 0x40;
			if (scope === 4) return idx <= 0x53;
			if (scope === 5) return idx < 16;
			if (scope === 6) return idx < 152;
			if (scope === 9) return idx < 32;
			if (scope === 0xa) return idx < 16;
			if (scope === 0xb) return idx < 512; // stack is 16 * 32 bits
			if (scope === 0xc) return idx < 5;
			if (scope === 0xd) return idx < 1088;
			if (scope === 0xe) return true; // all 4096 elements are valid
			return false;
		};

		bai.registerName = id => {
			if (id === 0x4000) return 'brgme'; // official, ref: script d01e
			if (id === 0x4002) return 'brg_target';
			if (id === 0x4003) return 'brg_turntaker';
			if (id === 0x4004) return 'brg_keypad_held';
			if (id === 0x4005) return 'brg_keypad_pressed';
			if (id === 0x4006) return 'brg_keypad_released';
			if (id === 0x4007) return 'brg_keypad_pressed_turbo';
			if (id === 0x4008) return 'brg_gkeypad_held';
			if (id === 0x4009) return 'brg_gkeypad_pressed';
			if (id === 0x400a) return 'brg_gkeypad_released';
			if (id === 0x400b) return 'brg_gkeypad_pressed_turbo';
			if (id === 0x400c) return 'brg_turntaker_action';
			if (id === 0x400e) return 'brg_bowser_here';
			if (id === 0x400f) return 'brg_scene';
			if (id === 0x4010) return 'brg_bmap_outside';
			if (id === 0x4011) return 'brg_bmap_inside';
			if (id === 0x4012) return 'brg_party_leader';
			if (id === 0x4013) return 'brg_bros_solo';
			if (id === 0x4014) return 'brg_started_inside';
			if (id === 0x4015) return 'brg_first_strike';
			if (id === 0x4016) return 'brg_transition';
			if (id === 0x4018) return 'brg_coins';
			if (id === 0x401a) return 'brg_stylus_status';
			if (id === 0x401b) return 'brg_stylus_x';
			if (id === 0x401c) return 'brg_stylus_y';
			if (id === 0x401d) return 'brg_pc_selected_item_id';
			if (id === 0x401e) return 'brg_pc_selected_action';
			if (id === 0x4023) return 'brgturn'; // official, ref: script 700a
			if (id === 0x4028) return 'brg_language';
			if (0x402a <= id && id <= 0x4049) return `brg_arg${id - 0x402a + 1}`; // "arg", ref: script 4014
			return `reg_${str16(id)}`;
		};

		bai.spriteFile = x => {
			if (x >>> 24 === 0xc0) return `BObjPc[0x${(x & 0xffff).toString(16)}]`;
			if (x >>> 24 === 0xc1) return `BObjMon[0x${(x & 0xffff).toString(16)}]`;
			if (x >>> 24 === 0xc2) return `BObjUI[0x${(x & 0xffff).toString(16)}]`;
			return '(?)';
		};

		bai.scriptFile = x => {
			const name = [
				undefined, // 0xxx
				'scn_yo', // 1xxx
				'mon_yo', // 2xxx
				'scn_ji', // 3xxx
				'mon_ji', // 4xxx
				'item_ji', // 5xxx
				'scn_cf', // 6xxx
				'mon_cf', // 7xxx
				undefined, // 8xxx
				undefined, // 9xxx
				'atk_nh', // Axxx
				undefined, // Bxxx
				'atk_yy', // Cxxx
				'atk_hk', // Dxxx
				undefined, // Exxx
				undefined, // Fxxx
			][x >> 12];
			if (name) return `${name}[${x & 0xfff}]`;
		};

		bai.typeNames = ['u8', 'u16', 'u32', 's8', 's16', 's32', 'fx16', 'fx32'];
		bai.typeSizes = [1, 2, 4, 1, 2, 4, 2, 4];

		const mapify = arr => new Map(arr.map((x, i) => [i, x]));
		bai.enumTypes = {
			action_block: mapify(['0', 'JUMP', 'HAMMER', 'FLEE', 'ITEM', 'SPECIAL', 'PUNCH', '7', '8', '9']),
			attribute: new Map([
				[3, 'X'],
				[4, 'Y'],
				[5, 'Z'],
				[9, 'HOME_X'],
				[10, 'HOME_Y'],
				[11, 'HOME_Z'],
				[24, 'ANIMATION'],
				[32, 'LEVEL'],
				[33, 'MAX_HP'],
				[34, 'HP'],
				[35, 'SPD'],
				[36, 'POW'],
				[37, 'DEF'],
				[47, 'INVINCIBLE'],
				[63, 'SPRITE'],
			]),
			attribute_monster: new Map([
				[2, 'SPRITE'],
				[12, 'FLYING'],
			]),
			counterattack: mapify(['NONE', 'JUMP', 'HAMMER', 'PUNCH', 'SHELL']),
			operator: mapify(['EQ', 'NE', 'LT', 'GT', 'LE', 'GE', 'AND', 'OR', 'XOR', 'EQ_ZERO', 'NOT']),
			positioning: mapify(['ABSOLUTE', 'RELATIVE']),
			slot: (() => {
				const map = new Map();
				map.set(0x1000, 'MARIO');
				map.set(0x1001, 'LUIGI');
				map.set(0x1002, 'KOOPA');

				const fill = (start, length, prefix) => {
					for (let i = 0; i < length; ++i) map.set(start + i, `${prefix}_${i}`);
					map.set(start + length, `${prefix}_MAX`);
				};
				fill(0x2000, 8, 'MONSTER');
				fill(0x3000, 32, 'ATK_OBJ');
				fill(0x4000, 16, 'OBJ');
				fill(0x5000, 24, 'OBJ_5XXX');
				// 6xxx is for abnormals
				fill(0xa000, 20, 'ATK_DESC');
				fill(0xb000, 12, 'DESC');
				fill(0xc000, 28, 'DESC_CXXX');

				return map;
			})(),
		};

		bai.cmdDetails = new Map([
			// 0x1 : return syntactic sugar
			[0x2, { args: ['operator', 's32', 's32', 's32', 'location'] }], // 0x2 : if/elif/else goto/tailcall
			[0x3, { args: ['u8', 'location'] }], // 0x3 : break/continue/tailcall/call/goto
			[0x4, { name: 'wait' }],
			[0x5, { name: 'stack_push' }],
			[0x6, { name: 'stack_pop' }],
			[0x7, { name: 'stack_compare', args: ['u16', 'u16', 's16', 'location'] }],
			// 0x8 : literal value
			// 0x9 - 0x12 : binary operator syntactic sugar
			// 0x13 : unary negation
			[0x14, { name: 'bool' }],
			// 0x15 : bitwise NOT
			// 0x16 - 0x21 : operator assignment syntactic sugar
			[0x22, { name: 'sqrt' }],
			[0x23, { name: 'invsqrt' }],
			[0x24, { name: 'reciprocal' }],
			[0x25, { name: 'sin' }],
			[0x26, { name: 'cos' }],
			[0x27, { name: 'atan' }],
			[0x28, { name: 'atan2' }],
			[0x29, { name: 'random' }],
			[0x2a, { name: 'fx32' }],
			[0x2b, { name: 'fx32_add' }],
			[0x2c, { name: 'fx32_subtract' }],
			[0x2d, { name: 'fx32_mul' }],
			[0x2e, { name: 'fx32_div' }],
			[0x2f, { name: 'fx32_remainder' }],
			[0x30, { name: 'fx32_to_int' }],
			[0x31, { name: 'fx32_trunc' }],
			[0x32, { name: 'fx32_sqrt' }],
			[0x33, { name: 'fx32_invsqrt' }],
			[0x34, { name: 'fx32_reciprocal' }],
			[0x35, { name: 'fx32_sin' }],
			[0x36, { name: 'fx32_cos' }],
			[0x37, { name: 'fx32_atan' }],
			[0x38, { name: 'fx32_atan2' }],
			// 0x39 : array access syntactic sugar
			[0x3a, { name: 'array_len' }],
			[0x3b, { name: 'debugln', args: ['location'] }],
			[0x3c, { name: 'debug', args: ['location'] }],
			[0x3d, { name: 'debug_bin' }],
			[0x3e, { name: 'debug_dec' }],
			[0x3f, { name: 'debug_hex' }],
			[0x40, { name: 'reset_game' }],
			[0x41, { name: 'add_coins' }],
			[0x43, { name: 'get_item_count', args: ['item'] }],
			[0x44, { name: 'add_items', args: ['item', 's8'] }],
			[0x45, { name: 'get_player_stat' }],
			[0x46, { name: 'set_player_stat' }],
			[0x47, { name: 'BA_0047_thread', args: ['slot', 'u8', 'location'] }],
			[0x48, { name: 'BA_0048_thread', args: ['slot', 'u8', 'location'] }],
			[0x49, { name: 'BA_0049_thread', args: ['slot', 'u8', 'location'] }],
			[0x4a, { name: 'thread_join', args: ['slot'] }],
			[0x4e, { args: ['slot'] }],
			[0x58, { name: 'party_turn_check' }],
			[0x59, { name: 'party_turn_wait' }],
			[
				0x63,
				{
					name: 'desc_by_sprite_id',
					args: ['slot', 'u32', 's8'],
					note: cmd => {
						if (cmd.registers & 0b10) return;
						return bai.spriteFile(cmd.args[1]);
					},
				},
			],
			[
				0x65,
				{
					name: 'desc_by_monster_id',
					args: ['slot', 'u16'],
					note: cmd => {
						if (cmd.registers & 0b10) return;
						return monsters.monsters[cmd.args[1]].name ?? '(?)';
					},
				},
			],
			[
				0x66,
				{
					name: 'load_atk_script',
					args: ['u16'],
					note: cmd => {
						if (cmd.registers & 1) return;
						return bai.scriptFile(cmd.args[0]);
					},
				},
			],
			[0x68, { name: 'desc_by_sprite_id_load', args: ['slot'] }],
			[0x69, { name: 'desc_by_monster_id_load', args: ['slot'] }],
			[0x6a, { name: 'load_atk_script2' }],
			[0x6d, { name: 'npc_init', args: ['slot'] }],
			[0x6f, { name: 'monster_apply_desc', args: ['slot'] }],
			[
				0x71,
				{
					name: 'set_bmap',
					note: cmd => {
						if (cmd.registers & 0b11) return;
						const bmap1P = cmd.args[0] === -1 ? 'default' : cmd.args[0];
						const bmap2P = cmd.args[1] === -1 ? 'default' : cmd.args[1];
						return `1 player = 0x${bmap1P.toString(16)}, 2 player = 0x${bmap2P.toString(16)}`;
					},
				},
			],
			[0x73, { name: 'counterattack_set', args: ['slot', 'counterattack'] }],
			[0x7b, { name: 'action_block_disable', args: ['action_block'] }],
			[0x7e, { name: 'end_battle' }],
			[0xbf, { name: 'attribute_get', args: ['slot', 'attribute'] }],
			[0xc0, { name: 'attribute_set', args: ['slot', 'attribute', 's32'] }],
			[0xc1, { name: 'attribute_set_fx32', args: ['slot', 'attribute', 'fx32'] }],
			[0xc6, { name: 'attribute_monster_get', args: ['slot', 'attribute_monster'] }],
			[0xc8, { name: 'kill', args: ['slot'] }],
			[0xc9, { name: 'destroy', args: ['slot'] }],
			[0xd3, { name: 'npc_apply_desc', args: ['slot'] }],
			[0xe7, { name: 'obj_move', args: ['slot', 'u8', 'positioning', 's16', 's16', 's16', 'speed:fx32'] }],
			[
				0xe8,
				{ name: 'obj_move_timed', args: ['slot', 'u8', 'positioning', 's16', 's16', 's16', 'duration:u16'] },
			],
			[0xe9, { name: 'obj_move_around_obj', args: ['slot', 'u8', 'slot', 's16', 's16', 's16', 'speed:fx32'] }],
			[
				0xea,
				{
					name: 'obj_move_around_obj_timed',
					args: ['slot', 'u8', 'slot', 's16', 's16', 's16', 'duration:u16'],
				},
			],
			[0xeb, { name: 'obj_move_wait', args: ['slot', 'u8'] }],
			[0xef, { name: 'obj_set_position', args: ['slot', 'positioning', 's16', 's16', 's16'] }],
			[0xf0, { name: 'obj_set_position_around_obj', args: ['slot', 'slot', 's16', 's16', 's16'] }],
			[0xf3, { name: 'obj_set_home', args: ['slot', 'positioning', 's16', 's16', 's16'] }],
			[0x10f, { name: 'obj_jump', args: ['slot', 'u8', 's16', 's16', 'fx32'] }],
			[0x121, { name: 'spawn_monster_atk_thread', args: ['slot', 'slot'] }],
			[0x122, { name: 'join_monster_atk_thread', args: ['slot'] }],
			[0x124, { name: 'monster_set_damage_victim', args: ['slot', 'u8', 'slot', 'fx16'] }],
			[0x125, { name: 'monster_set_damage_victims', args: ['slot', 'u8', 'fx16'] }],
			[0x126, { name: 'monster_clear_damage_victims', args: ['slot'] }],
			[
				0x1ee,
				{
					name: 'load_messages',
					note: cmd => {
						if (cmd.registers & 0b11) return;
						if (cmd.args[0] === 22) return `BMes_yo[0x${cmd.args[1].toString(16)}]`;
						if (cmd.args[0] === 23) return `BMes_ji[0x${cmd.args[1].toString(16)}]`;
						if (cmd.args[0] === 24) return `BMes_cf[0x${cmd.args[1].toString(16)}]`;
					},
				},
			],
			[0x1ef, { name: 'load_messages2' }],
			[0x1f1, { name: 'textbox_say' }],
			[0x1f2, { name: 'textbox_wait' }],
			[0x1fc, { name: 'sound_play_directional', args: ['slot', 'u32', 's16', 's16', 's16', 'u8', 'u8'] }],
			[0x1fd, { name: 'sound_play_directional_handle', args: ['slot', 'u32', 's16', 's16', 's16', 'u8', 'u8'] }],
			[0x1fe, { name: 'sound_play', args: ['slot', 'u32', 's16', 's16', 's16', 'u8', 'u8'] }],
			[0x1ff, { name: 'sound_play_handle', args: ['slot', 'u32', 's16', 's16', 's16', 'u8', 'u8'] }],
			[0x200, { name: 'sound_stop' }],
			[
				0x201,
				{
					name: 'music_set',
					note: cmd => {
						if (cmd.registers & 1) return;
						return sound.names[cmd.args[0]];
					},
				},
			],
			[
				0x202,
				{
					name: 'music_set2',
					note: cmd => {
						if (cmd.registers & 1) return;
						return sound.names[cmd.args[0]];
					},
				},
			],
			[0x203, { name: 'music_fade_out' }],
			[0x204, { args: ['operator', 's32', 's32', 's32', 's32', 'location'] }],
			[0x205, { args: ['operator', 'slot', 'attribute', 's32', 'location'] }],
			[0x206, { args: ['slot', 's8', 'location'] }],
			[0x207, { args: ['slot', 'u8', 's32', 'location'] }],
			[0x208, { args: ['slot', 's32', 'location'] }],
			[0x209, { args: ['slot', 's8', 's32', 'location'] }],
			// 0x204 - 0x209 : syntactic sugar for different "if" variants
			[0x213, { name: 'random_attack_target' }],
			[0x216, { name: 'is_monster', args: ['slot'] }],
			[0x219, { name: 'monster_next_slot' }],
			[0x21a, { name: 'desc_next_slot' }],
			[
				0x21b,
				{
					name: 'desc_by_sprite_id_cached',
					note: cmd => {
						if (cmd.registers & 0b10) return;
						return bai.spriteFile(cmd.args[1]);
					},
				},
			],
			[
				0x21c,
				{
					name: 'desc_by_monster_id_cached',
					note: cmd => {
						if (cmd.registers & 0b1) return;
						return monsters.monsters[cmd.args[0]].name ?? '(?)';
					},
				},
			],
			[0x221, { name: 'add_item_reward' }],
			[0x222, { name: 'add_coin_reward' }],
		]);

		// leftNode and rightNode are optional, node is required
		const llLink = (leftNode, node, rightNode) => {
			if (leftNode?.next) leftNode.next.prev = undefined;
			if (rightNode?.prev) rightNode.prev.next = undefined;
			if (leftNode) leftNode.next = node;
			if (rightNode) rightNode.prev = node;
			node.prev = leftNode;
			node.next = rightNode;
		};
		// shorthand for making a node
		const llNode = (type, left, right, fields) => {
			return { type, left, right, prev: undefined, next: undefined, ...fields };
		};

		bai.decomp = undefined; // decompilation output
		bai.decompiler = {};

		// Decompiles a single array or returns undefined if invalid.
		bai.decompiler.singleArray = (dat, left, right, allowPadding) => {
			let o = left;
			if (allowPadding) {
				// arrays start on 4-byte boundaries, using FF bytes for padding
				while (o & 3) {
					if (o + 1 > right) return;
					if (dat.getUint8(o) !== 0xff) return;
					++o;
				}
			}

			if (o + 2 > right) return;
			const length = dat.getUint8(o);
			const headerByte = dat.getUint8(o + 1);
			if ((headerByte & 0xf0) !== 0x80) return; // highest bit must be 1, don't know why

			const elementType = headerByte & 0xf;
			if (elementType >= 8) return;

			const elementSize = bai.typeSizes[elementType];
			if (o + 2 + elementSize * length > right) return;

			const elements = [];

			let o2 = o + 2;
			for (let i = 0; i < length; ++i) {
				if (elementType === 0) elements.push(dat.getUint8(o2));
				else if (elementType === 1) elements.push(dat.getUint16(o2, true));
				else if (elementType === 2) elements.push(dat.getUint32(o2, true));
				else if (elementType === 3) elements.push(dat.getInt8(o2));
				else if (elementType === 4) elements.push(dat.getInt16(o2, true));
				else if (elementType === 5) elements.push(dat.getInt32(o2, true));
				else if (elementType === 6) elements.push(dat.getInt16(o2, true) / 256);
				else if (elementType === 7) elements.push(dat.getInt32(o2, true) / 4096);

				o2 += elementSize;
			}

			let o3 = o2;
			if (allowPadding) {
				// arrays take up multiples of 4 bytes in size, the remaining padding bytes are FF
				while (o3 & 3) {
					if (o3 + 1 > right) return;
					if (dat.getUint8(o3) !== 0xff) return;
					++o3;
				}
			}

			return llNode('array', o, o2, { name: `array_${str16(o)}`, length, elementType, elements });
		};

		// Decompiles a single BA_ or CM_ command, or returns undefined if invalid.
		bai.decompiler.singleCommand = (dat, left, right) => {
			if (right - left < 6) return;

			const opcode = dat.getUint16(left, true);
			const registers = dat.getUint32(left + 2, true);
			if (opcode >= bai.dialect.length) return;

			const info = bai.dialect[opcode];
			// register flags must not be set for out-of-bounds arguments
			if (registers >>> info.args.length) return;

			let outputRegister;
			let o = left + 6;
			if (info.returns) {
				outputRegister = dat.getUint16(o, true);
				o += 2;
				if (!bai.isValidRegister(outputRegister)) return;
			}

			const args = [];
			for (let i = 0; i < info.args.length; ++i) {
				if (registers & (1 << i)) {
					const register = dat.getUint16(o, true);
					if (!bai.isValidRegister(register)) return;
					args.push(register);
					o += 2;
				} else {
					const type = info.args[i];
					// unsigned int
					if (type === 0) (args.push(dat.getUint8(o, true)), ++o);
					else if (type === 1) (args.push(dat.getUint16(o, true)), (o += 2));
					else if (type === 2) (args.push(dat.getUint32(o, true)), (o += 4));
					// signed int
					else if (type === 3) (args.push(dat.getInt8(o, true)), ++o);
					else if (type === 4) (args.push(dat.getInt16(o, true)), (o += 2));
					else if (type === 5) (args.push(dat.getInt32(o, true)), (o += 4));
					// fixed point (note, the divisions here are not lossy)
					else if (type === 6) (args.push(dat.getInt16(o, true) / 256), (o += 2));
					else if (type === 7) (args.push(dat.getInt32(o, true) / 4096), (o += 4));
				}
			}

			if (o > right) return;

			return llNode('cmd', left, o, { opcode, registers, outputRegister, args });
		};

		// "Decompiles" a single null-terminated Shift-JIS string, or returns undefined if not likely valid.
		bai.decompiler.singleString = (dat, left, right) => {
			let o2 = left;
			while (o2 < right) {
				const byte = dat.getUint8(o2++);
				if (byte === 0) break; // null-terminator
				if (1 <= byte && byte <= 0x1f && byte !== 0xa) return; // unexpected control character (0a = \n)
				if (0xfd <= byte) return; // unused byte in Shift-JIS (there are more, but this is good enough)
			}

			if (o2 - left <= 1) return; // no empty strings allowed
			return llNode('string', left, o2, { decoded: shiftJisDecoder.decode(sliceDataView(dat, left, o2 - 1)) });
		};

		// Converts a script's binary into a linked-list of commands (type "cmd") or unknowns (type "unknown").
		// This is the representation that other decompiler steps work with.
		bai.decompiler.first = dat => {
			// the first u16 of a script doesn't seem to be used (it's always 6), but it matches the # of events

			const eventLocation = eventIdx => {
				const o = eventIdx * 2 + 2;
				const jumpOffset = dat.getUint16(o, true); // unsigned offset, NOT signed
				if (jumpOffset === 0) return 0; // nothing bound
				return jumpOffset + o;
			};
			const events = {
				default: dat.getUint16(0, true) * 2 + 2, // clBtlAIBase virtual fun_0x28
				otherMonsterTurn: eventLocation(0),
				monsterInit: eventLocation(1),
				monsterTurn: eventLocation(2),
				playerTurn: eventLocation(3),
				unknown5: eventLocation(4),
				unknown6: eventLocation(5),
			};

			const locationStack = [];
			if (events.default) locationStack.push(events.default);
			for (let i = 0; i < 6; ++i) {
				const location = eventLocation(i);
				if (location) locationStack.push(location);
			}
			const headerEnd = Math.min(...locationStack);

			const head = llNode('head', 0, 0, { parent: undefined });
			const offsets = llNode('offsets', 0, 14, {});
			const middle = llNode('unknown', 14, dat.byteLength, {});
			const tail = llNode('tail', dat.byteLength, dat.byteLength, { parent: undefined });
			llLink(head, offsets, middle);
			llLink(middle, tail, undefined);

			let searches = 0;
			while (locationStack.length) {
				if (++searches >= 1000) {
					console.log(locationStack);
					console.log(head);
					throw 'nope';
				}
				let o = locationStack.pop();
				const startOffset = o;

				// find the node that contains this offset
				let node = head;
				while (node) {
					if (node.left <= o && o < node.right) break;
					node = node.next;
				}
				if (node.type !== 'unknown') continue; // already searched

				// this "unknown" node currently looks like: (--------------------------------------)
				// break it up into 3+ nodes:                (-----) (cmd1) (cmd2) ... (cmdN) (-----)
				let prev = node.prev;
				let next = node.next;
				if (node.left < o) {
					const newLeftUnknown = llNode('unknown', node.left, o, {});
					llLink(prev, newLeftUnknown, next);
					prev = newLeftUnknown;
				}
				if (o < node.right) {
					const newRightUnknown = llNode('unknown', o, node.right, {});
					llLink(prev, newRightUnknown, next);
					next = newRightUnknown;
				}

				while (o < dat.byteLength) {
					const newNode = bai.decompiler.singleCommand(dat, o, node.right);
					if (!newNode) {
						console.error('BEFORE:', bytes(o - 32, 32, dat));
						console.error('AFTER:', bytes(o, 32, dat));
						console.error('CONTEXT:', o, node.left, node.right);
						throw new Error('INVALID COMMAND IDK WHAT TO DO');
					}

					llLink(prev, newNode, next);
					prev = newNode;
					o = newNode.right;

					let terminates = false;
					next.left = o;
					if (next.left === next.right) {
						// no more "unknown" data left, remove this empty node and terminate this path
						prev.next = next.next;
						if (next.next) next.next.prev = prev;
						terminates = true;
					}

					// see if this command goes anywhere
					const { opcode, args } = newNode;
					if (opcode === 0)
						terminates = true; // terminate
					else if (opcode === 1)
						terminates = true; // return from function
					else if (opcode === 2)
						locationStack.push(o + args[4]); // conditional jump
					else if (opcode === 3) {
						// unconditional jump: mode 1 is a function call that *can* return
						if (args[0] !== 1) terminates = true;
						locationStack.push(o + args[1]);
					} else if (opcode === 7)
						locationStack.push(o + args[3]); // stack-conditional jump
					else if (opcode === 0x47)
						locationStack.push(o + args[2]); // actor threads
					else if (opcode === 0x48)
						locationStack.push(o + args[2]); // ^
					else if (opcode === 0x49)
						locationStack.push(o + args[2]); // ^
					else if (opcode === 0x204)
						locationStack.push(o + args[5]); // alternative if's
					else if (opcode === 0x205)
						locationStack.push(o + args[4]); // ^
					else if (opcode === 0x206)
						locationStack.push(o + args[2]); // ^
					else if (opcode === 0x207)
						locationStack.push(o + args[3]); // ^
					else if (opcode === 0x208)
						locationStack.push(o + args[2]); // ^
					else if (opcode === 0x209) locationStack.push(o + args[3]); // ^

					if (terminates) break;
				}
			}

			return { dat, events, head, tail };
		};

		// Discovers arrays and Shift-JIS strings from commands that use them. Breaks apart "unknown" types.
		// Handles these node types: cmd, unknown
		bai.decompiler.findStaticReferences = decomp => {
			const stringReferences = new Set();
			const arrayReferences = new Set();

			// first pass: find references
			let node = decomp.head;
			while (node) {
				if (node.type === 'cmd') {
					if (node.opcode === 0x39 || node.opcode === 0x3a) {
						arrayReferences.add(node.right + node.args[0]);
					} else if (node.opcode === 0x3b || node.opcode === 0x3c) {
						stringReferences.add(node.right + node.args[0]);
					}
				}

				node = node.next;
			}

			// second pass: break apart "unknown"s that contain references
			node = decomp.head;
			while (node) {
				if (node.type === 'unknown') {
					for (let o = node.left; o < node.right; ++o) {
						let newNode;
						if (stringReferences.has(o)) newNode = bai.decompiler.singleString(decomp.dat, o, node.right);
						else if (arrayReferences.has(o))
							newNode = bai.decompiler.singleArray(decomp.dat, o, node.right, false);

						if (newNode) {
							// replace node with newNode
							const prev = node.prev;
							const next = node.next;
							llLink(node.prev, newNode, node.next);

							// insert padding "unknown"s around newNode if necessary
							if (node.left < newNode.left) {
								const paddingLeft = llNode('unknown', node.left, newNode.left);
								llLink(prev, paddingLeft, newNode);
							}

							if (newNode.right < node.right) {
								const paddingRight = llNode('unknown', newNode.right, node.right);
								llLink(newNode, paddingRight, next);
							}

							node = newNode;
							o = node.right;
						}
					}
				}

				node = node.next;
			}
		};

		// Finds commands, strings, or arrays inside of "unknown" blocks, without any help from references.
		// Some structures generate dead code: for example, in the "if" part of an if-else block, there needs to be a
		// jump out of it, so that the "else" block is skipped. However if the "if" part contains a return (CM_0001),
		// the jump will become unreachable and dead.
		// Not detecting dead code as actual code pretty much destroys all control-flow pattern recognition from working
		// so this is necessary. Dead code will have its "dead" attribute set to true.
		// Handles these node types: unknown
		bai.decompiler.decompDeadCode = decomp => {
			const { dat } = decomp;

			let node = decomp.head;
			while (node) {
				if (node.type === 'unknown') {
					const commandNode = bai.decompiler.singleCommand(dat, node.left, node.right);
					const arrayNode = bai.decompiler.singleArray(dat, node.left, node.right, true);
					const stringNode = bai.decompiler.singleString(dat, node.left, node.right);

					// a stringNode is likely to appear (for example, CM_0040 would generate bytes 40 00, which is a
					// valid 1-byte string); however those aren't really useful so if a command is valid, we will prefer
					// that instead. commands > arrays > strings.
					const newNode = commandNode || arrayNode || stringNode;
					if (newNode) {
						llLink(node.prev, newNode, node);
						node.left = newNode.right; // !

						if (node.left === node.right) {
							// this "unknown" is now empty, remove it
							node.prev.next = node.next;
							node.next.prev = node.prev;
							node.prev = node.next = undefined;
						}

						node = newNode;

						// singleArray can skip over padding bytes; we want to preserve those in the decompilation
						if (newNode.prev.right < newNode.left) {
							const newUnknown = {
								type: 'unknown',
								left: newNode.prev.right,
								right: newNode.left,
								prev: newNode.prev,
								next: newNode,
							};
							newNode.prev.next = newUnknown;
							newNode.prev = newUnknown;
						}
					}
				}

				node = node.next;
			}
		};

		// Creates functions using all CM_0003 (mode 1), BA_0047, BA_0048, and BA_0049 references.
		// Handles these node types: cmd
		bai.decompiler.guaranteedFunctions = decomp => {
			const functionLabels = new Map();
			const addFunctionLabel = (location, name) => {
				if (!location) return; // for unbound events
				if (!name) name = `fun_${str16(location)}`;

				const others = functionLabels.get(location);
				if (others) others.add(name);
				else functionLabels.set(location, new Set([name]));
			};

			// 1. add event functions
			addFunctionLabel(decomp.events.otherMonsterTurn, 'event_other_monster_turn');
			addFunctionLabel(decomp.events.monsterInit, 'event_monster_init');
			addFunctionLabel(decomp.events.monsterTurn, 'event_monster_turn');
			addFunctionLabel(decomp.events.playerTurn, 'event_player_turn');
			addFunctionLabel(decomp.events.unknown5, 'event_unknown5');
			addFunctionLabel(decomp.events.unknown6, 'event_unknown6');

			// add the default event last, because in mon scripts it points to some other event instead
			if (!functionLabels.has(decomp.events.default)) addFunctionLabel(decomp.events.default, 'event_default');

			// 2. add functions from commands that are known to work with functions (and not just jump offsets)
			let node = decomp.head;
			while (node) {
				if (node.type === 'cmd') {
					if (node.opcode === 3 && node.args[0] === 1) {
						// CM_0003 mode 1 is a function call (it pushes a return address to the stack)
						addFunctionLabel(node.right + node.args[1], undefined);
					} else if (node.opcode === 0x49) {
						// BA_0049 starts a new actor thread at a function
						addFunctionLabel(node.right + node.args[2], undefined);
					}
				}

				node = node.next;
			}

			// 3. with function labels known, put all commands into a function. note the function labels act more like
			// separators between known functions.
			node = decomp.head;
			while (node) {
				if (node.type === 'cmd') {
					let names = functionLabels.get(node.left);
					if (!names) names = new Set([`fun_${str16(node.left)}_implicit`]);

					const prev = node.prev;

					let innerFirst = node;
					let innerLast = node;
					while (true) {
						const next = innerLast.next;
						if (next?.type !== 'cmd') break;
						if (functionLabels.get(next.left)) break;
						innerLast = next;
					}

					const next = innerLast.next;

					const innerHead = llNode('head', innerFirst.left, innerFirst.left, { parent: undefined });
					const innerTail = llNode('tail', innerLast.right, innerLast.right, { parent: undefined });
					llLink(undefined, innerHead, innerFirst);
					llLink(innerLast, innerTail, undefined);

					const newNode = llNode('fn', innerHead.left, innerTail.right, { names, innerHead, innerTail });
					innerHead.parent = innerTail.parent = newNode;
					llLink(prev, newNode, next);

					node = newNode;
				}

				node = node.next;
			}
		};

		// Detects if..else and switch.
		// Handles these node types: fn, cmd
		bai.decompiler.controlFlow = decomp => {
			const searchStack = [{ node: decomp.head, left: decomp.head.left, right: decomp.tail.right }];
			while (searchStack.length) {
				let { node, left, right } = searchStack.pop();
				const startNode = node;

				// preprocess
				const locationToNode = new Map();
				while (node) {
					locationToNode.set(node.left, node);
					node = node.next;
				}

				node = startNode;
				while (node) {
					if (node.type === 'fn') {
						searchStack.push(
							{ node: node.innerHead, left: node.left, right: node.right },
							{ node: node.next, left, right },
						);
						node = undefined;
					} else if (node.type === 'cmd') {
						// if-else match:
						//    CM_0002(operator, left, right, false, @a)
						//    ...
						//    CM_0003(2, @b)
						// @a ...
						//    ...
						// @b ...
						// The target boolean must be false. When it's true, it's some other structure.
						// If the "else" block ends up only containing an "if" node: (head) (if) (tail)
						// Then it will be collapsed into newNode (turning it into an if-elif-elif-...-else node).
						if (node.opcode === 2 && !(node.registers & 0b11001))
							(() => {
								// operator, targetBool, jumpOffset must be constant
								const [operator, valueLeft, valueRight, targetBool, elseOffset] = node.args;
								// condition must be false (i.e. SKIP if condition is false), must jump forward and skip at
								// least one command (CM_0003)
								if (targetBool !== 0 || elseOffset <= 0) return;

								const elseLocation = node.right + elseOffset;
								const elseNode = locationToNode.get(elseLocation);
								if (!elseNode) return;

								const lastIfNode = elseNode.prev; // guaranteed to not be `node`
								// lastIfMode and exitOffset must be constant
								if (
									lastIfNode.type !== 'cmd' ||
									lastIfNode.opcode !== 3 ||
									lastIfNode.registers & 0b11
								) {
									return;
								}

								// must be mode 2 and a non-negative offset (0 is okay too)
								const [exitMode, exitOffset] = lastIfNode.args;
								if (exitMode !== 2 || exitOffset < 0) return;

								const exitNode = locationToNode.get(lastIfNode.right + exitOffset);
								if (!exitNode) return;

								// pattern is valid: build out newNode
								const emptyIfBlock = lastIfNode.prev === node;
								const emptyElseBlock = exitOffset === 0;
								const firstIfNode = node.next;
								const lastElseNode = exitNode.prev;
								const prev = node.prev;

								const newNode = llNode('if', node.left, exitNode.left, {
									conditionBlocks: [],
									elseBlock: undefined,
								});

								const ifBlockHead = llNode('head', node.right, node.right, { parent: newNode });
								const ifBlockTail = llNode('tail', lastIfNode.right, lastIfNode.right, {
									parent: newNode,
								});
								if (emptyIfBlock) {
									llLink(ifBlockHead, lastIfNode, ifBlockTail);
									llLink(undefined, ifBlockHead, ifBlockTail);
								} else {
									llLink(undefined, ifBlockHead, firstIfNode);
									llLink(lastIfNode, ifBlockTail, undefined);
								}

								const newLastIfNode = llNode('if-exit', lastIfNode.left, lastIfNode.right, {
									cmd: lastIfNode,
								});
								llLink(lastIfNode.prev, newLastIfNode, lastIfNode.next);

								newNode.conditionBlocks.push({
									cmd: node,
									innerHead: ifBlockHead,
									innerTail: ifBlockTail,
								});

								const elseBlockHead = llNode('head', elseNode.left, elseNode.left, { parent: newNode });
								const elseBlockTail = llNode('tail', exitNode.left, exitNode.left, { parent: newNode });
								if (emptyElseBlock) {
									llLink(undefined, elseBlockHead, elseBlockTail);
								} else {
									llLink(undefined, elseBlockHead, elseNode);
									llLink(lastElseNode, elseBlockTail, undefined);
								}
								newNode.elseBlock = { innerHead: elseBlockHead, innerTail: elseBlockTail };

								llLink(prev, newNode, exitNode);
								searchStack.push(
									{ node: ifBlockHead, left: ifBlockHead.left, right: ifBlockTail.right },
									{ node: elseBlockHead, left: elseBlockHead.left, right: elseBlockTail.right },
									{ node: exitNode, left, right },
								);
								node = undefined;
							})();

						// from here on, `node` could be undefined if it already matched something
						// switch match:
						// reg_1000 = ...
						// CM_0003(2, @a)
						// ... (unknown if there is ever code in this part)
						// CM_0003(2, @exit)
						// @a CM_0002(1, left, reg_1000, 1, @b)
						// ...
						// CM_0003(2, @exit)
						// @b CM_0002(1, left, reg_1000, 1, @c)
						// ...
						// CM_0003(2, @exit)
						// (there could be even more cases in between here)
						// @z CM_0002(1, left, reg_1000, 1, @exit)
						// ...
						// CM_0003(2, @exit)
						// @exit
						if (node && node.outputRegister === 0x1000)
							(() => {
								let entry = true;
								let exitNode;
								let conditionNode = node.next;

								let entryBlock;
								const conditionBlocks = [];
								const breakNodes = new Set();
								let defaultBlock;
								while (conditionNode) {
									let nextConditionNode;
									if (entry) {
										// match CM_0003(2, @a); must skip at least one instruction (the exit)
										if (conditionNode.type !== 'cmd' || conditionNode.opcode !== 3) return;
										if (conditionNode.registers & 0b11) return; // all arguments must be constant
										if (conditionNode.args[0] !== 2 || conditionNode.args[1] <= 0) return;

										nextConditionNode = locationToNode.get(
											conditionNode.right + conditionNode.args[1],
										);
									} else {
										(() => {
											// match CM_0002(1, left, reg_1000, @b); must skip at least one instruction
											if (conditionNode.type !== 'cmd' || conditionNode.opcode !== 2) return;

											const [operator, left, right, targetBool, jumpOffset] = conditionNode.args;
											// operator, targetBool, and jumpLocation must be constant
											if (conditionNode.registers & 0b11001) return;
											// must jump forward
											if (operator !== 1 || targetBool !== 1 || jumpOffset <= 0) return;
											// right must be reg_1000
											if (!(conditionNode.registers & 0b00100) || right !== 0x1000) return;

											nextConditionNode = locationToNode.get(conditionNode.right + jumpOffset);
										})();

										if (!nextConditionNode) {
											// this is a default case
											defaultBlock = { innerFirst: conditionNode, innerLast: exitNode.prev };
											break;
										}
									}

									if (!nextConditionNode) return;

									// must match CM_0003(2, @exit); jump offset can be zero, but not negative
									const breakNode = (() => {
										const breakNode = nextConditionNode.prev;
										if (breakNode.type !== 'cmd' || breakNode.opcode !== 3) return;
										if (breakNode.registers & 0b11) return; // all arguments must be constant
										if (breakNode.args[0] !== 2 || breakNode.args[1] < 0) return;

										if (entry) {
											exitNode = locationToNode.get(breakNode.right + breakNode.args[1]);
											if (!exitNode) return;
										} else {
											if (breakNode.right + breakNode.args[1] !== exitNode.left) return;
										}

										return breakNode;
									})();
									if (breakNode) breakNodes.add(breakNode);

									const block = {
										cmd: conditionNode,
										innerFirst: conditionNode.next,
										innerLast: nextConditionNode.prev,
									};
									if (entry) entryBlock = block;
									else conditionBlocks.push(block);

									if (nextConditionNode === exitNode) break; // no more *blocks*
									if (!breakNode) return; // still got more blocks to go, so there has to be a break node

									entry = false;
									conditionNode = nextConditionNode;
								}

								if (!conditionBlocks.length) return;

								// this is a switch statement, now make it
								const prev = node;
								const next = exitNode;

								const tryReplaceBreak = breakNode => {
									if (!breakNodes.has(breakNode)) return;

									const newBreakNode = llNode('switch-break', breakNode.left, breakNode.right, {
										cmd: breakNode,
									});
									llLink(breakNode.prev, newBreakNode, breakNode.next);
								};

								const newNode = llNode('switch', entryBlock.cmd.left, exitNode.left, {
									entryBlock: undefined,
									conditionBlocks: [],
									defaultBlock: undefined,
								});

								const entryHead = llNode(
									'head',
									entryBlock.innerFirst.left,
									entryBlock.innerFirst.left,
									{ parent: newNode },
								);
								const entryTail = llNode(
									'tail',
									entryBlock.innerLast.right,
									entryBlock.innerLast.right,
									{ parent: newNode },
								);
								llLink(undefined, entryHead, entryBlock.innerFirst);
								llLink(entryBlock.innerLast, entryTail, undefined);
								tryReplaceBreak(entryBlock.innerLast);
								newNode.entryBlock = { innerHead: entryHead, innerTail: entryTail };

								for (let i = 0; i < conditionBlocks.length; ++i) {
									const block = conditionBlocks[i];
									const condHead = llNode('head', block.innerFirst.left, block.innerFirst.left, {
										parent: newNode,
									});
									const condTail = llNode('tail', block.innerLast.right, block.innerLast.right, {
										parent: newNode,
									});
									llLink(undefined, condHead, block.innerFirst);
									llLink(block.innerLast, condTail, undefined);
									tryReplaceBreak(block.innerLast);
									newNode.conditionBlocks.push({
										cmd: block.cmd,
										innerHead: condHead,
										innerTail: condTail,
									});
								}

								if (defaultBlock) {
									const { innerFirst, innerLast } = defaultBlock;
									const defaultHead = llNode('head', innerFirst.left, innerFirst.left, {
										parent: newNode,
									});
									const defaultTail = llNode('tail', innerLast.right, innerLast.right, {
										parent: newNode,
									});
									llLink(undefined, defaultHead, innerFirst);
									llLink(innerLast, defaultTail, undefined);
									tryReplaceBreak(innerLast);
									newNode.defaultBlock = { innerHead: defaultHead, innerTail: defaultTail };
								}

								llLink(prev, newNode, next);
								searchStack.push({ node: entryHead, left: entryHead.left, right: entryTail.right });
								for (const { innerHead, innerTail } of newNode.conditionBlocks) {
									searchStack.push({ node: innerHead, left: innerHead.left, right: innerTail.right });
								}
								if (newNode.defaultBlock) {
									const { innerHead, innerTail } = newNode.defaultBlock;
									searchStack.push({ node: innerHead, left: innerHead.left, right: innerHead.right });
								}
								searchStack.push({ node: next, left, right });
								node = undefined;
							})();
					}

					if (node) node = node.next;
				}
			}
		};

		// Collapses all: if { ... } else { if { ... } } patterns into: if { ... } else if { ... }.
		// Handles these node types: fn, if, switch
		bai.decompiler.collapseIfElse = decomp => {
			const ifs = [];

			const searchStack = [decomp.head];
			while (searchStack.length) {
				let node = searchStack.pop();
				while (node) {
					if (node.type === 'fn') {
						searchStack.push(node.innerHead, node.next);
						node = undefined;
					} else if (node.type === 'if') {
						ifs.push(node);
						for (let i = 0; i < node.conditionBlocks.length; ++i) {
							searchStack.push(node.conditionBlocks[i].innerHead);
						}
						if (node.elseBlock) searchStack.push(node.elseBlock.innerHead);
						searchStack.push(node.next);
						node = undefined;
					} else if (node.type === 'switch') {
						searchStack.push(node.entryBlock.innerHead);
						for (const block of node.conditionBlocks) searchStack.push(block.innerHead);
						if (node.defaultBlock) searchStack.push(node.defaultBlock.innerHead);
						searchStack.push(node.next);
						node = undefined;
					}

					if (node) node = node.next;
				}
			}

			// find "if" nodes that only have a single "if" node in their else block
			// iterate backwards, that way nested "if"s are handled first
			for (let i = ifs.length - 1; i >= 0; --i) {
				const node = ifs[i];
				if (!node.elseBlock) continue;

				const innerFirst = node.elseBlock.innerHead.next;
				if (innerFirst !== node.elseBlock.innerTail.prev) continue;
				if (innerFirst.type !== 'if') continue;

				for (let j = 0; j < innerFirst.conditionBlocks.length; ++j) {
					node.conditionBlocks.push(innerFirst.conditionBlocks[j]);
				}

				node.elseBlock = innerFirst.elseBlock;
			}
		};

		// Matches much simpler if's from CM_0002 and BA_0204 - BA_0209 (no "else" block).
		// Done last, when there is no other justification for these "if"s to exist.
		// Handles these node types: cmd, fn, if, switch
		bai.decompiler.simpleIfBlock = decomp => {
			const searchStack = [decomp.head];
			while (searchStack.length) {
				let node = searchStack.pop();
				const startNode = node;

				// preprocess
				const locationToNode = new Map();
				while (node) {
					locationToNode.set(node.left, node);
					node = node.next;
				}

				node = startNode;
				while (node) {
					if (node.type === 'cmd') {
						// match plain "if":
						// CM_0002(operator, left, right, 0, @a)
						// ...
						// @a ...
						if (node.opcode === 2 || (0x204 <= node.opcode && node.opcode <= 0x209))
							(() => {
								// operator, targetBool, and jumpOffset must be constant
								let targetBool, jumpOffset;
								if (node.opcode === 2) {
									if (node.registers & 0b11001) return;
									targetBool = node.args[3];
									jumpOffset = node.args[4];
								} else if (node.opcode === 0x204) {
									if (node.registers & 0b110001) return;
									targetBool = node.args[4];
									jumpOffset = node.args[5];
								} /* else if (node.opcode === 0x205) {
								if (node.registers & 0b11001) return;
								targetBool = node.args[3]; // technically "targetValue"
								jumpOffset = node.args[4];
							} else if (node.opcode === 0x206) {
								if (node.registers & 0b110) return;
								targetBool = node.args[1];
								jumpOffset = node.args[2];
							} else if (node.opcode === 0x207) {
								if (node.registers & 0b1100) return;
								targetBool = node.args[2];
								jumpOffset = node.args[3];
							} else if (node.opcode === 0x208) {
								if (node.registers & 0b110) return;
								targetBool = node.args[1];
								jumpOffset = node.args[2];
							} else if (node.opcode === 0x209) {
								if (node.registers & 0b1100) return;
								targetBool = node.args[2]; // technically "targetValue"
								jumpOffset = node.args[3];
							} */

								// targetBool must be 0 (SKIP if condition is false), must not jump backwards
								if (targetBool !== 0 || jumpOffset < 0) return;

								const exitNode = locationToNode.get(node.right + jumpOffset);
								if (!exitNode) return;

								const newNode = llNode('if', node.left, exitNode.left, {
									conditionBlocks: [],
									elseBlock: undefined,
								});

								const prev = node.prev;
								const next = exitNode;
								const innerFirst = node.next;
								const innerLast = exitNode.prev;
								const innerHead = llNode('head', innerFirst.left, innerFirst.left, { parent: newNode });
								const innerTail = llNode('tail', innerLast.right, innerLast.right, { parent: newNode });
								if (jumpOffset === 0) {
									// empty block
									llLink(undefined, innerHead, innerTail);
								} else {
									llLink(undefined, innerHead, innerFirst);
									llLink(innerLast, innerTail, undefined);
								}

								llLink(undefined, node, undefined);
								newNode.conditionBlocks.push({ cmd: node, innerHead, innerTail });
								llLink(prev, newNode, next);
								searchStack.push(innerHead, next);
								node = undefined;
							})();
					} else if (node.type === 'fn') {
						searchStack.push(node.innerHead, node.next);
						node = undefined;
					} else if (node.type === 'if') {
						for (const block of node.conditionBlocks) searchStack.push(block.innerHead);
						if (node.elseBlock) searchStack.push(node.elseBlock.innerHead);
						searchStack.push(node.next);
						node = undefined;
					} else if (node.type === 'switch') {
						searchStack.push(node.entryBlock.innerHead);
						for (const block of node.conditionBlocks) searchStack.push(block.innerHead);
						if (node.defaultBlock) searchStack.push(node.defaultBlock.innerHead);
						searchStack.push(node.next);
						node = undefined;
					}

					if (node) node = node.next;
				}
			}
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
			for (const [path, scriptSpace] of options) {
				if (scriptSpace === undefined) continue; // BAI_atk_mt cannot be loaded, anyway

				let type;
				if (path.includes('_atk_')) type = 'atk';
				else if (path.includes('_mon_')) type = 'mon';
				else if (path.includes('_scn_')) type = 'scn';

				const segments = fsext.battle.get(path);
				for (let i = 0; i < segments.length - 1; ++i) {
					const script = scriptSpace + i;
					const decomp = bai.decompiler.first(segments[i]);
					bai.decompiler.findStaticReferences(decomp);
					bai.decompiler.decompDeadCode(decomp);

					let node = decomp.head;
					while (node) {
						if (node.type === 'cmd') {
							if (node.opcode === 0x66) {
								// load attack script
								if (node.registers & (1 << 0)) {
									node = node.next;
									continue;
								}

								const atkScript = node.args[0];
								const ref = attackToInvokerReferences.get(atkScript);
								if (ref) ref[type].add(script);
								else
									attackToInvokerReferences.set(atkScript, {
										atk: new Set(),
										mon: new Set(),
										scn: new Set(),
										[type]: new Set([script]),
									});
							} else if (node.opcode === 0x65) {
								// create monster from description id
								if (node.registers & (1 << 1)) {
									node = node.next;
									continue;
								}

								const monsterId = node.args[1];
								const ref = monsterToCreatorReferences.get(monsterId);
								if (ref) ref[type].add(script);
								else
									monsterToCreatorReferences.set(monsterId, {
										atk: new Set(),
										mon: new Set(),
										scn: new Set(),
										[type]: new Set([script]),
									});

								const ref2 = creatorToMonsterReferences.get(script);
								if (ref2) ref2.add(monsterId);
								else creatorToMonsterReferences.set(script, new Set([monsterId]));
							}
						}

						node = node.next;
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
				const [path, scriptSpace] = options[i];
				if (scriptSpace === undefined) continue;

				let type;
				if (path.includes('_atk_')) type = 'atk';
				else if (path.includes('_mon_')) type = 'mon';
				else if (path.includes('_scn_')) type = 'scn';

				const segments = fsext.battle.get(path);
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

					const parts = [`<code>${str16(script)}</code> ${j}. (len 0x${segments[j].byteLength.toString(16)}) `];
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

				const components = line.match(
					/^(@[A-Za-z0-9_]+)?\s*(?:var\[0x([0-9A-Fa-f]{4})\]\s*\=\s*)?(?:BA|CM)_([A-Fa-f0-9]{4})\(([^\)]*)\)(?:\s*\/\/.*)?$/,
				);
				if (!components) throw `invalid line: ${line}`;

				const label = components[1];
				if (label) {
					if (labelLocations.has(label)) throw L + `Label ${label} already in use`;
					labelLocations.set(label, o);
				}

				const assignment = components[2];

				const opcode = parseInt(components[3], 16);
				const command = bai.dialect[opcode];
				if (!command) throw L + `Command 0x${str16(opcode)} not found`;
				if (assignment && !command.returns) throw L + `Command 0x${str16(opcode)} does not return a value`;
				if (!assignment && command.returns) throw L + `Command 0x${str16(opcode)} must accept a return value`;

				let varflags = 0;
				const rawArgs = components[4] === '' ? [] : components[4].split(', ');
				if (rawArgs.length !== command.args.length)
					throw L + `Command 0x${str16(opcode)} expects ${command.args.length} args, got ${rawArgs.length}`;

				dat.setUint16(o, opcode, true);
				o += 2;
				const varflagsOffset = o;
				o += 4;
				if (command.returns) {
					dat.setUint16(o, parseInt(assignment, 16), true);
					o += 2;
				}

				const labelInjectOffsetRightTodos = [];
				const write = (i, x) => {
					if (command.args[i] === 0) dat.setUint8(o++, x);
					else if (command.args[i] === 1) (dat.setUint16(o, x, true), (o += 2));
					else if (command.args[i] === 2) (dat.setUint32(o, x, true), (o += 4));
					else if (command.args[i] === 3) dat.setInt8(o++, x);
					else if (command.args[i] === 4) (dat.setInt16(o, x, true), (o += 2));
					else if (command.args[i] === 5) (dat.setInt32(o, x, true), (o += 4));
					else if (command.args[i] === 6) (dat.setInt16(o, x * 256, true), (o += 2));
					else if (command.args[i] === 7) (dat.setInt32(o, x * 4096, true), (o += 4));
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
						dat.setUint16(o, parseInt(varMatch[1], 16), true);
						o += 2;
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
					const [writeAt, base] = locations[i];
					dat.setInt16(writeAt, loc - base, true);
				}
			}

			return sliceDataView(dat, 0, o);
		};

		bai.decompiler.stringify = (decomp, isHtml) => {
			const output = [];

			const builtin = isHtml ? x => `<span style="color: var(--peach);">${x}</span>` : x => x;
			const fn = isHtml ? x => `<span style="color: var(--blue);">${x}</span>` : x => x;
			const keyword = isHtml ? x => `<span style="color: var(--mauve);">${x}</span>` : x => x;
			const constant = isHtml ? x => `<span style="color: var(--peach);">${x}</span>` : x => x;
			const storage = isHtml ? x => `<span style="color: var(--yellow);">${x}</span>` : x => x;
			const operator = isHtml ? x => `<span style="color: var(--teal);">${x}</span>` : x => x;
			const text = isHtml ? x => `<span style="color: var(--text);">${x}</span>` : x => x;
			const location = isHtml ? x => `<span style="color: var(--sapphire);">${x}</span>` : x => x;
			const string = isHtml ? x => `<span style="color: var(--green);">${x}</span>` : x => x;
			const comment = isHtml ? x => '<span style="color:var(--overlay2)">' + x + '</span>' : x => x;
			const error = isHtml ? x => '<span style="color:var(--red)">' + x + '</span>' : x => x;
			const pad = isHtml ? '&nbsp;' : ' ';

			const labelNames = new Map();
			let node = decomp.head;
			while (node) {
				if (node.type === 'fn') {
					labelNames.set(node.left, fn([...node.names][0]));
				} else if (node.type === 'array') {
					labelNames.set(node.left, storage(node.name));
				} else if (node.type === 'string') {
					labelNames.set(node.left, string('"' + node.decoded + '"'));
				}

				node = node.next;
			}

			node = decomp.head;

			let indent = 0;
			const prefix = (localNode = node) => {
				return (localNode ? str16(localNode.left) : '----') + pad.repeat(indent * 4 + 1);
			};

			const argF = (i, enumType, localNode = node) => {
				let prefix = '';
				if (enumType && enumType.includes(':')) {
					let [label, actualEnumType] = enumType.split(':');
					prefix = `${label}=`;
					enumType = actualEnumType;
				}

				const x = localNode.args[i];
				if (localNode.registers & (1 << i)) {
					const name = useCustomNames.checked ? bai.registerName(x) : `reg_${str16(x)}`;
					if (x >> 12 === 4) return prefix + storage(name); // 4xxx variables are special
					return prefix + text(name);
				}

				if (enumType === 'location') {
					const to = localNode.right + x;
					return prefix + (labelNames.get(to) ?? location(str16(to)));
				}

				if (useCustomNames.checked) {
					const enums = bai.enumTypes[enumType];
					if (enums) {
						const name = enums.get(x);
						if (name) return prefix + constant(name);
					}
				}

				const type = bai.dialect[localNode.opcode].args[i];
				if (type <= 5) {
					// u8, u16, u32, s8, s16, s32
					if (x <= -128) return prefix + constant('-0x' + (-x).toString(16));
					if (x <= 127) return prefix + constant(String(x));
					return prefix + constant('0x' + x.toString(16));
				}
				return prefix + constant(String(x)); // fx16, fx32 (leave as-is)
			};

			const outF = (localNode = node) => {
				if (bai.dialect[localNode.opcode].returns) {
					let regName;
					if (useCustomNames.checked) regName = bai.registerName(localNode.outputRegister);
					else regName = `reg_${str16(localNode.outputRegister)}`;

					if (localNode.outputRegister >> 12 === 4) return `${storage(regName)} ${operator('=')} `;
					return `${text(regName)} ${operator('=')} `;
				}
				return '';
			};

			const distF = dist => (dist >= 0 ? '+' : '') + String(dist);

			const containerStack = [];
			while (node) {
				if (node.type === 'head' || node.type === 'tail') {
					// don't render heads or tails
				} else if (node.type === 'offsets') {
					const formatLocation = location => (location ? `@ ${str16(location)}` : 'n/a');
					output.push(
						[
							`0000 // event_default ${formatLocation(decomp.events.default)}`,
							`0002 // event_other_monster_turn ${formatLocation(decomp.events.otherMonsterTurn)}`,
							`0004 // event_monster_init ${formatLocation(decomp.events.monsterInit)}`,
							`0006 // event_monster_turn ${formatLocation(decomp.events.monsterTurn)}`,
							`0008 // event_player_turn ${formatLocation(decomp.events.playerTurn)}`,
							`000a // event_unknown5 ${formatLocation(decomp.events.unknown5)}`,
							`000c // event_unknown6 ${formatLocation(decomp.events.unknown6)}`,
						].join(isHtml ? '<br>' : '\n'),
					);
				} else if (node.type === 'unknown') {
					output.push(prefix() + bytes(node.left, node.right - node.left, decomp.dat));
				} else if (node.type === 'cmd') {
					const op = node.opcode;
					const info = bai.dialect[op];
					const details = bai.cmdDetails.get(op);

					let str;
					// custom syntax
					if (useCustomNames.checked) {
						if (op === 1) str = keyword('return');
						if (op === 2) {
							let comp = '(' + bai.compare(node.args[0], argF(1), argF(2), operator) + ')';
							if (!node.args[3]) comp = operator('!') + comp;
							str =
								`${keyword('if')} ${comp} ${keyword('goto')} ${argF(4, 'location')} ` +
								`// (${distF(node.args[4])})`;
						}
						if (op === 3) {
							if (node.args[0] === 1) str = `${argF(1, 'location')}()`;
							else
								str =
									`${keyword('goto')} ${argF(1, 'location')} ` +
									`// (${distF(node.args[1])} mode ${node.args[0]})`;
						}
						if (op === 8) str = outF() + argF(0);
						if (op === 9) str = outF() + argF(0) + operator(' + ') + argF(1);
						if (op === 0xa) str = outF() + argF(0) + operator(' - ') + argF(1);
						if (op === 0xb) str = outF() + argF(0) + operator(' * ') + argF(1);
						if (op === 0xc) str = outF() + argF(0) + operator(' / ') + argF(1);
						if (op === 0xd) str = outF() + argF(0) + operator(' % ') + argF(1);
						if (op === 0xe) str = outF() + argF(0) + operator(' << ') + argF(1);
						if (op === 0xf) str = outF() + argF(0) + operator(' >> ') + argF(1);
						if (op === 0x10) str = outF() + argF(0) + operator(' & ') + argF(1);
						if (op === 0x11) str = outF() + argF(0) + operator(' | ') + argF(1);
						if (op === 0x12) str = outF() + argF(0) + operator(' ^ ') + argF(1);
						if (op === 0x13) str = outF() + operator('-') + argF(0);
						if (op === 0x15) str = outF() + operator('~') + argF(0);
						if (0x16 <= op && op <= 0x21) {
							let target = bai.registerName(node.outputRegister);
							if (node.outputRegister >> 12 === 4) target = storage(target);
							else target = text(target);

							if (op === 0x16) str = target + operator('++');
							if (op === 0x17) str = target + operator('--');
							if (op === 0x18) str = target + operator(' += ') + argF(0);
							if (op === 0x19) str = target + operator(' -= ') + argF(0);
							if (op === 0x1a) str = target + operator(' *= ') + argF(0);
							if (op === 0x1b) str = target + operator(' /= ') + argF(0);
							if (op === 0x1c) str = target + operator(' %= ') + argF(0);
							if (op === 0x1d) str = target + operator(' <<= ') + argF(0);
							if (op === 0x1e) str = target + operator(' >>= ') + argF(0);
							if (op === 0x1f) str = target + operator(' &= ') + argF(0);
							if (op === 0x20) str = target + operator(' |= ') + argF(0);
							if (op === 0x21) str = target + operator(' ^= ') + argF(0);
						}
						if (op === 0x39) str = outF() + `${argF(0, 'location')}[${argF(1)}]`;
					}

					// standard syntax
					const common = op <= 0x46;
					if (!str) {
						const argsF = [];
						for (let i = 0; i < info.args.length; ++i) argsF.push(argF(i, details?.args?.[i]));

						let name = useCustomNames.checked && details?.name;
						name ||= `${common ? 'CM' : 'BA'}_${str16(op).toUpperCase()}`;
						str = outF() + `${(common ? builtin : fn)(name)}(${argsF.join(', ')})`;
					}

					const note = details?.note?.(node);
					if (note) str += ' // ' + note;

					output.push(prefix() + str);
				} else if (node.type === 'string') {
					output.push(prefix() + string('"' + node.decoded + '"'));
				} else if (node.type === 'array') {
					const typeName = bai.typeNames[node.elementType];

					const elementsF = [];
					for (let i = 0; i < node.elements.length; ++i) {
						const x = node.elements[i];
						if (node.elementType <= 5) {
							// u8, u16, u32, s8, s16, s32
							const slotName = bai.enumTypes.slot.get(x);
							if (slotName) elementsF.push(constant(slotName));
							else if (x <= -128) elementsF.push(constant('-0x' + (-x).toString(16)));
							else if (x <= 127) elementsF.push(constant(String(x)));
							else elementsF.push(constant('0x' + x.toString(16)));
						} else {
							// fx16, fx32
							elementsF.push(constant(String(x)));
						}
					}

					const decl = `${storage(typeName)} ${text(node.name)}[${constant(node.length)}]`;
					output.push(prefix() + `${decl} ${operator('=')} { ${elementsF.join(', ')} }`);
				} else if (node.type === 'fn') {
					const localNode = node;
					const names = [...node.names];
					output.push(prefix() + `${keyword('def')} ${fn(names[0])}() {`);
					++indent;
					node = node.innerHead;
					containerStack.push(() => {
						--indent;
						output.push(prefix(undefined) + `}`);
						return localNode.next;
					});
				} else if (node.type === 'if') {
					const localNode = node;
					let index = 0;
					const step = () => {
						if (index > 0) --indent;

						if (index < localNode.conditionBlocks.length) {
							let condition;
							const block = localNode.conditionBlocks[index];
							const cmd = block.cmd;
							if (cmd.opcode === 2) {
								condition = bai.compare(
									cmd.args[0],
									argF(1, undefined, cmd),
									argF(2, undefined, cmd),
									operator,
								);
							} else if (cmd.opcode === 0x204) {
								const comparator = bai.compare(
									cmd.args[0],
									argF(1, undefined, cmd),
									argF(2, undefined, cmd),
									operator,
								);
								condition = `(${comparator}) ${operator('==')} ${argF(3, undefined, cmd)}`;
							} /* else if (cmd.opcode === 0x205) {
								// this command only gets turned into an "if" if the jump occurs if falsy (i.e. block
								// is only entered if the attribute is truthy)
								const slot = argF(0, 'slot', cmd);
								const attr = argF(1, 'attribute', cmd);
								condition = `${fn('attribute_get')}(${slot}, ${attr})`;
							} else if (cmd.opcode === 0x206) {
								// unknown what this does
								condition = `!${fn('BA_0206')}(${argF(0, 'slot', cmd)})`;
							} else if (cmd.opcode === 0x207) {
								// unknown what this does
								condition = `!${fn('BA_0207')}(${argF(0, 'slot', cmd)}, ${argF(1, undefined, cmd)})`;
							} else if (cmd.opcode === 0x208) {
								condition = `${operator('!')}${fn('BA_0208')}(${argF(0, 'slot', cmd)})`;
							} else if (cmd.opcode === 0x209) {
								const slot = argF(0, 'slot', cmd);
								const contextState = argF(1, undefined, cmd);
								condition = `${operator('!')}${fn('BA_0209')}(${slot}, ${contextState})`;
							} */ else {
								condition = error(`&lt;UNSUPPORTED CONDITION CMD: ${str16(cmd.opcode)}&gt;`);
							}

							if (index === 0) {
								output.push(prefix(block.cmd) + `${keyword('if')} (${condition}) {`);
							} else {
								output.push(prefix(block.cmd) + `} ${keyword('else if')} (${condition}) {`);
							}

							++indent;
							++index;
							containerStack.push(step);
							return block.innerHead;
						} else if (index === localNode.conditionBlocks.length && localNode.elseBlock) {
							// else block
							output.push(prefix(undefined) + `} ${keyword('else')} {`);
							++indent;
							++index;
							containerStack.push(step);
							return localNode.elseBlock.innerHead;
						} else {
							// exit
							output.push(prefix(undefined) + '}');
							return localNode.next;
						}
					};
					node = step();
				} else if (node.type === 'if-exit') {
					// display nothing
				} else if (node.type === 'switch') {
					const localNode = node;
					let index = 0;
					const step = () => {
						if (index === 0) {
							output.push(
								prefix(undefined) + `${keyword('switch')} (${text(bai.registerName(0x1000))}) {`,
							);
							++indent;
							++index;
							containerStack.push(step);
							return localNode.entryBlock.innerHead;
						} else if (index - 1 < localNode.conditionBlocks.length) {
							const block = localNode.conditionBlocks[index - 1];
							--indent;
							output.push(prefix(block.cmd) + `${keyword('case')} ${argF(1, undefined, block.cmd)}:`);
							++indent;
							++index;
							containerStack.push(step);
							return block.innerHead;
						} else if (index === localNode.conditionBlocks.length + 1 && localNode.defaultBlock) {
							const block = localNode.defaultBlock;
							--indent;
							output.push(prefix(block.cmd) + `${keyword('default')}:`);
							++indent;
							++index;
							containerStack.push(step);
							return block.innerHead;
						} else {
							--indent;
							output.push(prefix(undefined) + '}');
							return localNode.next;
						}
					};
					node = step();
				} else if (node.type === 'switch-break') {
					output.push(prefix() + keyword('break'));
				} else {
					output.push(prefix() + error(`&lt;UNSUPPORTED NODE TYPE: ${node.type}&gt;`));
				}

				node = node.next;
				if (!node) {
					node = containerStack.pop()?.();
				}
			}

			if (isHtml) return output.map(x => '<div>' + x + '</div>').join(''); // <div></div> faster than <br>
			else return output.join('\n');
		};

		const update = () => {
			metaPreview.innerHTML = codePreview.innerHTML = '';

			const [path, scriptSpace] = options[fileSelect.value];
			let segments;
			if (scriptSpace) {
				segments = fsext.battle.get(options[fileSelect.value][0]);
			} else {
				// bai_atk_mt is not referenced anywhere
				segments = [fs.get(path)];
			}

			if (!segments) {
				metaPreview.innerHTML = 'No segments/offsets for this file for this game version';
				scriptSelect.style.display = 'none';
				return;
			}

			const segmentNames = scriptSelectNames[fileSelect.value];
			scriptSelect.replaceWith((scriptSelect = dropdown(segmentNames, 0, () => updateScript())));

			updateScript = () => {
				const script = segments[scriptSelect.value];
				metaPreview.innerHTML = codePreview.innerHTML = '';

				const startTimestamp = performance.now();

				const decomp = (bai.decomp = bai.decompiler.first(script));
				bai.decompiler.findStaticReferences(decomp);
				bai.decompiler.decompDeadCode(decomp);
				bai.decompiler.guaranteedFunctions(decomp);
				bai.decompiler.controlFlow(decomp);
				bai.decompiler.collapseIfElse(decomp);
				bai.decompiler.simpleIfBlock(decomp);

				const decompTimestamp = performance.now();

				updateDisplay = () => {
					const startPreviewTimestamp = performance.now();

					codePreview.innerHTML = bai.decompiler.stringify(decomp, true);
					metaPreview.innerHTML = '';

					const previewTimestamp = performance.now();
					const decompTime = (decompTimestamp - startTimestamp).toFixed(1);
					const renderTime = (previewTimestamp - startPreviewTimestamp).toFixed(1);
					addHTML(metaPreview, `<div>decomp: ${decompTime}ms, render: ${renderTime}ms</div>`);
				};
				updateDisplay();
				return;
			};
			updateScript();
		};
		update();

		return bai;
	}));
};
