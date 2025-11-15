window.initField = () => {
	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Field Maps                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	const field = (window.field = createSection('Field Maps', (section) => {
		const field = {};

		const treasureFile = fs.get('/Treasure/TreasureInfo.dat');

		const layoutPreview = document.createElement('div');
		section.appendChild(layoutPreview);

		let maxTreasureId = 0;
		field.rooms = [];
		for (let i = 0, j = 0; i < fsext.fieldRoomIndices.length; i += 5, ++j) {
			field.rooms[j] = {
				l1: fsext.fieldRoomIndices[i],
				l2: fsext.fieldRoomIndices[i + 1],
				l3: fsext.fieldRoomIndices[i + 2],
				props: fsext.fieldRoomIndices[i + 3],
				treasure: fsext.fieldRoomIndices[i + 4],
			};
			maxTreasureId = Math.max(maxTreasureId, field.rooms[j].treasure);
		}

		field.treasure = [[]];
		for (let i = 0; field.treasure.length - 1 <= maxTreasureId; ++i) {
			const packed = treasureFile.getUint16(i * 12, true);
			field.treasure[field.treasure.length - 1].push(sliceDataView(treasureFile, i * 12, i * 12 + 12));
			if (packed & 1) field.treasure.push([]); // end of this room's treasure
		}

		let updatePalettes = true;
		let updateTiles = true;
		let updateMaps = true;
		let updateOverlay2d = true;
		let updateOverlay3d = true;
		let updateOverlay3dTriangles = true;

		// define options UI
		const options = (field.options = {});
		const optionRows = [0, 1].map(() => document.createElement('div'));
		for (const row of optionRows) section.appendChild(row);

		optionRows[0].style.cssText = 'position: sticky; top: 0; z-index: 5; background: #11111b; margin-bottom: 1px;';

		options.roomDropdown = dropdown(
			field.rooms.map((_, i) => `Room 0x${i.toString(16)}`),
			0,
			() => roomPicked(),
		);
		optionRows[0].appendChild(options.roomDropdown);

		// options about displaying the map itself
		optionRows[0].appendChild((options.bg1 = checkbox('BG1', true, () => (updateMaps = updateOverlay2d = true))));
		optionRows[0].appendChild((options.bg2 = checkbox('BG2', true, () => (updateMaps = updateOverlay2d = true))));
		optionRows[0].appendChild((options.bg3 = checkbox('BG3', true, () => (updateMaps = updateOverlay2d = true))));
		optionRows[0].appendChild(
			(options.margins = checkbox(
				'Margins',
				true,
				() => (updateMaps = updateOverlay2d = updateOverlay3d = true),
			)),
		);
		optionRows[0].appendChild(button('Export PNG', () => exportPng()));
		optionRows[0].appendChild(
			(options.previewPalettes = checkbox('Palettes', false, () => componentLayoutChanged())),
		);
		optionRows[0].appendChild(
			(options.previewTilesets = checkbox('Tilesets', false, () => componentLayoutChanged())),
		);
		let animationsToggledCallback = () => {};
		optionRows[0].appendChild(
			(options.animations = checkbox('Animations', false, () => {
				animationsToggledCallback();
			})),
		);

		// options about overlays of extra data, put on top of the map
		optionRows[1].appendChild((options.treasure = checkbox('Treasure', false, () => (updateOverlay2d = true))));
		optionRows[1].appendChild((options.depth = checkbox('Depth', false, () => (updateOverlay2d = true))));
		optionRows[1].appendChild(
			(options.collision = checkbox(
				'Collision',
				false,
				() => (updateOverlay3d = updateOverlay3dTriangles = true),
			)),
		);

		// preview area layout
		const previewContainer = document.createElement('div');
		previewContainer.style.cssText = `width: 100%; display: grid; grid-template-columns: 1fr 300px; gap: 8px;
			margin-top: 8px;`;
		section.appendChild(previewContainer);

		const mapContainer = document.createElement('div');
		mapContainer.style.cssText = `grid-column: 1; grid-row: 1; max-width: 100%; overflow-x: auto;
			position: relative;`;
		previewContainer.appendChild(mapContainer);

		const componentContainer = document.createElement('div');
		componentContainer.style.cssText = `grid-column: 1; grid-row: 2; display: grid;
			grid-template-columns: repeat(8, 128px); max-width: 100%; overflow-x: auto;`;
		previewContainer.appendChild(componentContainer);

		const sideProperties = document.createElement('div');
		sideProperties.style.cssText = `grid-column: 2; grid-row: 1 / 3;`;
		previewContainer.appendChild(sideProperties);

		const bottomProperties = document.createElement('div');
		bottomProperties.style.cssText = 'grid-column: 1 / 3; grid-row: 3;';
		previewContainer.appendChild(bottomProperties);

		// map preview
		const mapCanvas = document.createElement('canvas');
		mapContainer.appendChild(mapCanvas);

		const map2dOverlay = document.createElement('canvas');
		map2dOverlay.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(map2dOverlay);

		const map3dOverlay = document.createElement('canvas');
		map3dOverlay.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(map3dOverlay);

		// component preview
		const paletteCanvases = [0, 1, 2].map(() => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 16;
			canvas.style.cssText = 'display: none; width: 100%; height: 100%;';
			componentContainer.appendChild(canvas);
			return canvas;
		});

		const tilesetCanvases = [0, 1, 2].map(() => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 256;
			canvas.style.cssText = 'display: none; width: 100%; height: 100%;';
			componentContainer.appendChild(canvas);
			return canvas;
		});

		const componentLayoutChanged = () => {
			const apply = (canvas, column, row) => {
				canvas.style.display = '';
				canvas.style.gridColumn = column;
				canvas.style.gridRow = row;
			};
			const hide = (canvas) => (canvas.style.display = 'none');

			if (options.previewPalettes.checked && options.previewTilesets.checked) {
				apply(paletteCanvases[0], '1', '1');
				apply(paletteCanvases[1], '2', '1');
				apply(paletteCanvases[2], '1', '2');
				apply(tilesetCanvases[0], '3 / 5', '1 / 3');
				apply(tilesetCanvases[1], '5 / 7', '1 / 3');
				apply(tilesetCanvases[2], '7 / 9', '1 / 3');
				componentContainer.style.gridTemplateRows = '128px 128px';
			} else if (options.previewPalettes.checked) {
				apply(paletteCanvases[0], '1', '1');
				apply(paletteCanvases[1], '2', '1');
				apply(paletteCanvases[2], '3', '1');
				for (const canvas of tilesetCanvases) hide(canvas);
				componentContainer.style.gridTemplateRows = '128px';
			} else if (options.previewTilesets.checked) {
				for (const canvas of paletteCanvases) hide(canvas);
				apply(tilesetCanvases[0], '1 / 3', '1 / 3');
				apply(tilesetCanvases[1], '3 / 5', '1 / 3');
				apply(tilesetCanvases[2], '5 / 7', '1 / 3');
				componentContainer.style.gridTemplateRows = '128px 128px';
			} else {
				for (const canvas of paletteCanvases) hide(canvas);
				for (const canvas of tilesetCanvases) hide(canvas);
				componentContainer.style.gridTemplateRows = '';
			}
		};

		// side properties
		const side = {};
		sideProperties.appendChild((side.layerDisplay = document.createElement('div')));
		sideProperties.appendChild((side.treasureDropdown = dropdown(['0 treasures'], 0, () => {})));
		sideProperties.appendChild((side.treasureDisplay = document.createElement('div')));
		sideProperties.appendChild((side.loadingZoneDropdown = dropdown(['0 loading zones'], 0, () => {})));
		sideProperties.appendChild((side.loadingZoneDisplay = document.createElement('div')));
		sideProperties.appendChild((side.collisionDropdown = dropdown(['0 prisms, 0 specials'], 0, () => {})));
		sideProperties.appendChild((side.collisionDisplay = document.createElement('div')));
		sideProperties.appendChild((side.layerAnimList = document.createElement('div')));
		sideProperties.appendChild((side.tileAnimList = document.createElement('div')));
		sideProperties.appendChild((side.metadataDisplay = document.createElement('div')));

		// setup basic 3d overlay
		const map3d = (() => {
			const gl = map3dOverlay.getContext('webgl2', {
				alpha: true,
				depth: true,
				preserveDrawingBuffer: true,
			});

			const vs = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(
				vs,
				`
				#version 300 es
				precision highp float;
				layout(location = 0) in vec3 a_pos;
				layout(location = 1) in vec4 a_color;
				out vec4 v_color;

				uniform vec2 canvas_size;
				uniform vec3 pivot;
				uniform mat3 rotation1;
				uniform mat3 rotation2;
				uniform vec3 translation;

				void main() {
					v_color = a_color;
					vec3 pos = rotation2 * rotation1 * (a_pos - pivot) + translation;
					pos = vec3(pos.xy / canvas_size * 2.0, pos.z);
					gl_Position = vec4(pos.x, -pos.y, 1.0 / (pos.z + 1000.0), 1);
				}
				`.trim(),
			);
			gl.compileShader(vs);
			if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
				throw `map3d vertex compilation fail:\n${gl.getShaderInfoLog(vs)}`;

			const fs = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(
				fs,
				`
				#version 300 es
				precision highp float;
				in vec4 v_color;
				out vec4 out_color;

				void main() {
					out_color = v_color;
				}
				`.trim(),
			);
			gl.compileShader(fs);
			if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
				throw `map3d fragment compilation fail:\n${gl.getShaderInfoLog(fs)}`;

			const program = gl.createProgram();
			gl.attachShader(program, vs);
			gl.attachShader(program, fs);
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS))
				throw `map3d program link fail:\n${gl.getProgramInfoLog(program)}`;

			gl.useProgram(program);

			const vao = gl.createVertexArray();
			gl.bindVertexArray(vao);

			const buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 4 * 7, 0);
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 4 * 7, 4 * 3);

			const canvasSize = gl.getUniformLocation(program, 'canvas_size');
			const pivot = gl.getUniformLocation(program, 'pivot');
			const rotation1 = gl.getUniformLocation(program, 'rotation1');
			const rotation2 = gl.getUniformLocation(program, 'rotation2');
			const translation = gl.getUniformLocation(program, 'translation');

			let lastClientX;
			let lastClientY;
			let rotX = 0;
			let rotY = Math.PI / 4;
			let dragging = false;
			map3dOverlay.addEventListener('mousedown', () => void (dragging = true));
			addEventListener('mouseup', () => void ((dragging = false), (lastClientX = lastClientY = undefined)));
			addEventListener('blur', () => void ((dragging = false), (lastClientX = lastClientY = undefined)));

			map3dOverlay.addEventListener('dragstart', (e) => e.preventDefault());

			map3dOverlay.addEventListener('mousemove', (e) => {
				if (!dragging) return;
				if (lastClientX !== undefined && lastClientY !== undefined) {
					rotX = (rotX - (e.clientX - lastClientX) * 0.01) % (2 * Math.PI);
					rotY = Math.min(Math.max(rotY - (e.clientY - lastClientY) * 0.01, 0), (Math.PI * 3) / 4);
					updateOverlay3d = true;
				}
				lastClientX = e.clientX;
				lastClientY = e.clientY;
			});

			return {
				buffer,
				rotX: () => rotX,
				rotY: () => rotY,
				uniforms: { canvasSize, pivot, rotation1, rotation2, translation },
			};
		})();

		field.room = undefined;

		const paletteImages = [0, 1, 2].map(() => new ImageData(16, 16));
		const tilesetImages = [0, 1, 2].map(() => new ImageData(256, 256));
		let mapBitmap = new Uint32Array(256 * 192);
		let vertexFloats = new Float32Array(7 * 1000);
		let vertexFloatsUsed = 0;

		const roomPicked = () => {
			const indices = field.rooms[options.roomDropdown.value];

			updatePalettes = updateTiles = updateMaps = updateOverlay2d = true;
			updateOverlay3d = updateOverlay3dTriangles = true;

			const room = (field.room = {
				indices,
				props: unpackSegmented(lzBis(fsext.fmapdata.segments[indices.props])),
				tilesets: [indices.l1, indices.l2, indices.l3].map(
					(index) => index !== -1 && bufToU8(lzBis(fsext.fmapdata.segments[index])),
				),
			});
			Object.assign(room, {
				tilemaps: [room.props[0], room.props[1], room.props[2]].map((buf) => bufToU16(buf)),
				palettes: [room.props[3], room.props[4], room.props[5]].map((buf) => rgb15To32(bufToU16(buf))),
				map: room.props[6],
				loadingZones: room.props[7],
				layerAnimations: room.props[9],
				tileAnimations: room.props[10],
				paletteAnimations: [room.props[11], room.props[12], room.props[13]].map((buf) =>
					unpackSegmented16(buf),
				),
				collision: room.props[14],
				depth: room.props[8],
			});
			room.enabledLayerAnimations = new Set();
			room.enabledTileAnimations = new Set();

			const mapWidth = room.map.getUint16(0, true);
			const mapHeight = room.map.getUint16(2, true);
			const mapFlags = bufToU8(room.map);
			room.actualHeight =
				Math.max(room.tilemaps[0].length, room.tilemaps[1].length, room.tilemaps[2].length) / mapWidth;

			const targetMapBitmapSize = mapWidth * Math.max(mapHeight, room.actualHeight) * 64;
			if (mapBitmap.length < targetMapBitmapSize) {
				let size = mapBitmap.length;
				while (size < targetMapBitmapSize) size *= 2;
				mapBitmap = new Uint32Array(size);
			}

			// side properties layer info
			const bgAttributes = [[], [], []];
			if (mapFlags[5] & 0x08) bgAttributes[1].push('above obj'); // BG2 above obj
			if (mapFlags[5] & 0x10) bgAttributes[0].push('above obj'); // BG1 above obj
			if (mapFlags[8] & 0x01) bgAttributes[2].push('above BG2'); // BG3 above BG2
			if (mapFlags[8] & 0x02) bgAttributes[2].push('above BG1'); // BG3 above BG1
			if (mapFlags[8] & 0x20) bgAttributes[0].push('autoscrolls'); // BG1 autoscrolls
			if (mapFlags[8] & 0x40) bgAttributes[1].push('autoscrolls'); // BG2 autoscrolls
			if (mapFlags[8] & 0x80) bgAttributes[2].push('autoscrolls'); // BG3 autoscrolls

			const bgSpeedLookup = ['-', '0.25x', '0.5x', '2x', '-1x', '-0.25x', '-0.5x', '-1x'];
			for (let i = 0; i < 3; ++i) {
				const layerFlags = mapFlags[9 + i];

				const horizontalSpeed = layerFlags & 7;
				const horizontalLocked = layerFlags & 8;
				const verticalSpeed = (layerFlags >> 4) & 7;
				const verticalLocked = (layerFlags >> 4) & 8;

				if (horizontalLocked && verticalLocked) bgAttributes[i].push('locked horizontally and vertically');
				else if (horizontalLocked) bgAttributes[i].push('locked horizontally');
				else if (verticalLocked) bgAttributes[i].push('locked vertically');

				if (horizontalSpeed) bgAttributes[i].push(`${bgSpeedLookup[horizontalSpeed]} horizontal`);
				if (verticalSpeed) bgAttributes[i].push(`${bgSpeedLookup[verticalSpeed]} vertical`);
			}

			side.layerDisplay.innerHTML = `
				<div><code>${mapWidth}x${mapHeight} tiles
					${room.actualHeight === mapHeight ? '' : `(${mapWidth}x${room.actualHeight} actual)`}
					(${mapWidth * 8}x${mapHeight * 8}px)
				</code></div>
				<div>${bgAttributes[0].length ? 'BG1: ' + bgAttributes[0].join(', ') : ''}</div>
				<div>${bgAttributes[1].length ? 'BG2: ' + bgAttributes[1].join(', ') : ''}</div>
				<div>${bgAttributes[2].length ? 'BG3: ' + bgAttributes[2].join(', ') : ''}</div>
			`;

			// side properties treasure
			const treasureSegments = field.treasure[indices.treasure] || [];
			const treasureOptions = [`${treasureSegments.length} treasures`];
			const treasureTypeLookup = [
				'Bean',
				'Floating Block',
				'-',
				'-',
				'Brick Block',
				'Grass',
				'-',
				'Underwater Brick Block',
			];
			for (let i = 0; i < treasureSegments.length; ++i) {
				const flags = treasureSegments[i].getUint16(0, true);
				const type = (flags >> 1) & 0xf;
				treasureOptions.push(`[${i}] ${treasureTypeLookup[type]}`);
			}
			side.treasureDropdown.replaceWith(
				(side.treasureDropdown = dropdown(treasureOptions, 0, () => {
					updateOverlay2d = true;
					if (side.treasureDropdown.value === 0) {
						side.treasureDisplay.innerHTML = '';
						return;
					}

					const treasure = treasureSegments[side.treasureDropdown.value - 1];
					const flags = treasure.getUint16(0, true);
					const itemId = treasure.getUint16(2, true);
					const treasureId = treasure.getUint16(4, true);
					side.treasureDisplay.innerHTML = `<div style="border-left: 1px solid #76f;
					margin-left: 1px; padding-left: 8px;">
					Treasure 0x${treasureId.toString(16)},
					item 0x${itemId.toString(16)},
					quantity 0x${((flags >> 10) & 0x1f).toString(16)},
					count/anim 0x${((flags >> 5) & 0x1f).toString(16)}</div>`;
				})),
			);
			side.treasureDisplay.innerHTML = '';

			// side properties loading zones
			const loadingZoneOptions = [`${room.loadingZones.byteLength / 24} loading zones`];
			for (let i = 0, o = 0; o < room.loadingZones.byteLength; ++i, o += 24) {
				const flags = room.loadingZones.getUint16(o, true);
				const toRoom = room.loadingZones.getUint16(o + 2, true);
				const direction = '↑→↓←'[(flags >> 2) & 3];
				loadingZoneOptions.push(`[${i}] ${direction} 0x${toRoom.toString(16)}`);
			}

			side.loadingZoneDropdown.replaceWith(
				(side.loadingZoneDropdown = dropdown(
					loadingZoneOptions,
					0,
					() => {
						updateOverlay3d = updateOverlay3dTriangles = true;
						if (side.loadingZoneDropdown.value === 0) {
							side.loadingZoneDisplay.innerHTML = '';
							return;
						}

						const o = (side.loadingZoneDropdown.value - 1) * 24;
						const [flags, roomId, x1, y1, z, x2, y2, enterX1, enterY1, enterZ, enterX2, enterY2] = bufToU16(
							sliceDataView(room.loadingZones, o, o + 24),
						);

						const lines = [];
						lines.push(`<code>([${x1}..${x1 + x2}], [${y1}..${y1 + y2}], ${z})</code>`);
						const xRange = !(flags & 2) || enterX2 === 1 ? enterX1 : `[${enterX1}..${enterX1 + enterX2}]`;
						const yRange = !(flags & 2) || enterY2 === 1 ? enterY1 : `[${enterY1}..${enterY1 + enterY2}]`;
						lines.push(`Enter at: <code>(${xRange}, ${yRange}, ${enterZ})</code>`);

						side.loadingZoneDisplay.innerHTML = `<div style="border-left: 1px solid #76f; margin-left: 1px;
					padding-left: 8px;">${lines.map((x) => '<div>' + x + '</div>').join(' ')}</div>`;
					},
					() => {
						updateOverlay3d = updateOverlay3dTriangles = true;
					},
				)),
			);
			side.loadingZoneDisplay.innerHTML = '';

			// side properties collision
			if (room.collision.byteLength) {
				const numBoxes = room.collision.getUint32(0, true);
				const numSpecials = room.collision.getUint32(4, true);

				const options = [`${numBoxes} prisms, ${numSpecials} specials`];
				for (let i = 0, o = 8; i < numBoxes; ++i, o += 40) {
					const solidActions = room.collision.getUint16(o + 4, true);
					const attributes = room.collision.getUint16(o + 6, true);

					let color;
					if (solidActions !== 0xffff) color = '#0ff';
					if (attributes & 0xfffe) color = '#f90';
					if (attributes & 1) color = '#f00';

					options.push(`[${i}] Prism ${color ? `<span style="color: ${color}">◼︎</span>` : ''}`);
				}
				for (let i = 0; i < numSpecials; ++i) options.push(`[${i}] Special`);
				side.collisionDropdown.replaceWith(
					(side.collisionDropdown = dropdown(
						options,
						0,
						() => {
							updateOverlay3d = updateOverlay3dTriangles = true;
							if (side.collisionDropdown.value === 0) {
								side.collisionDisplay.innerHTML = '';
								return;
							}

							const index = side.collisionDropdown.value - 1;
							let o = 8;
							o += Math.min(index, numBoxes) * 40; // first chunk of prisms
							o += Math.max(index - numBoxes, 0) * 24; // second chunk of... things

							if (index < numBoxes) {
								// prism
								const config = room.collision.getUint16(o, true);
								const debugId = room.collision.getUint16(o + 2, true);
								const solidActions = room.collision.getUint16(o + 4, true);
								const attributes = room.collision.getUint16(o + 6, true);

								const html = [];

								const configStrings = [];
								if (config & 1) configStrings.push('last');
								// if (config & 2) configStrings.push('snaps up'); // needs more research
								if (config & 4) configStrings.push('simple');
								if (configStrings.length) html.push(`<div>Config: ${configStrings.join(', ')}</div>`);

								for (let i = 0; i < 4; ++i) {
									const x = room.collision.getInt16(o + 8 + i * 8, true);
									const y = room.collision.getInt16(o + 8 + i * 8 + 2, true);
									const ztop = room.collision.getInt16(o + 8 + i * 8 + 4, true);
									const zbottom = room.collision.getInt16(o + 8 + i * 8 + 6, true);

									if (i === 3 && !(config & 8)) {
										// (config & 8) means the prism is four-pointed, 0 if three-pointed
										// very few prisms have a fourth vertex that isn't zeroed out
										if (x || y || ztop || zbottom) {
											html.push(
												`<div style="color: #f99;">v4 <code>(${x}, ${y}, [${zbottom}..${ztop}])</code></div>`,
											);
										}
									} else {
										html.push(
											`<div>v${i + 1} <code>(${x}, ${y}, [${zbottom}..${ztop}])</code></div>`,
										);
									}
								}

								html.push(`<div>Debug ID: ${debugId >> 6}</div>`);

								const actions = [
									'Walking', // 0x1
									'M&L Drilling', // 0x2
									'Mini Mario', // 0x4
									'M&L Stacked (before drill/twirl)', // 0x8
									'M&L Twirling', // 0x10
									,
									,
									,
									// 0x20
									// 0x40
									// 0x80
									'B Spike Balling', // 0x100
									,
									,
									,
									// 0x200
									// 0x400
									// 0x800
									'M&L Hammering / B Punching', // 0x1000
									'B Flaming', // 0x2000
									// 0x4000
									// 0x8000
									,
									,
								];
								const solidNames = [];
								const notSolidNames = [];
								for (let bit = 1, i = 0; bit < 0xffff; bit <<= 1, ++i) {
									if (!actions[i]) continue;
									if (solidActions & bit) solidNames.push(actions[i]);
									else notSolidNames.push(actions[i]);
								}
								if (notSolidNames.length === 0) {
									// do nothing
								} else if (solidNames.length === 0) {
									// not solid at all?
									html.push('<div style="color: #0ff;">Not solid</div>');
								} else if (solidNames.length >= notSolidNames.length) {
									html.push(
										`<div style="color: #0ff;">Solid unless: ${notSolidNames.join(', ')}</div>`,
									);
								} else {
									html.push(
										`<div style="color: #0ff;">Not solid unless: ${solidNames.join(', ')}</div>`,
									);
								}

								const attributeStrings = [];
								if (attributes & 1) attributeStrings.push('no-enter');
								if (attributes & 4) attributeStrings.push('spike ball grippy');
								if (attributes & 0x40) attributeStrings.push('unisolid');

								if (attributeStrings.length)
									html.push(`<div style="color: ${attributes & 1 ? '#f00' : '#f90'}">
								Attributes: ${attributeStrings.join(', ')}</div>`);

								side.collisionDisplay.innerHTML = `<div style="border-left: 1px solid #76f;
							margin-left: 1px; padding-left: 8px;">${html.join(' ')}</div>`;
							} else {
								// special
								side.collisionDisplay.innerHTML = `<div style="border-left: 1px solid #76f;
							margin-left: 1px; padding-left: 8px;"><code>${bytes(o, 24, room.collision)}</code></div>`;
							}
						},
						() => {
							updateOverlay3d = updateOverlay3dTriangles = true;
						},
					)),
				);
			} else {
				side.collisionDropdown.replaceWith(
					(side.collisionDropdown = dropdown(['0 prisms, 0 specials'], 0, () => {})),
				);
			}
			side.collisionDisplay.innerHTML = '';

			// side properties layer animations
			const layerAnimations = unpackSegmented(room.layerAnimations);
			side.layerAnimList.innerHTML = 'Layer Animations: ';
			for (let i = 1, j = 0; i < layerAnimations.length; i += 3, ++j) {
				if (layerAnimations[i].byteLength < 8) continue;

				const container = { segment: layerAnimations[i] }; // may contain the other two layers later
				const check = checkbox('', false, () => {
					if (check.checked) room.enabledLayerAnimations.add(container);
					else room.enabledLayerAnimations.delete(container);
					updateMaps = true;
				});
				side.layerAnimList.appendChild(check);
			}

			// side properties tile animations
			const tileAnimations = unpackSegmented(room.tileAnimations);
			side.tileAnimList.innerHTML = 'Tile Animations: ';
			const tileAnimationsDefault = [];
			for (let i = 0; i < tileAnimations.length; ++i) {
				const flags = tileAnimations[i].getUint32(0, true);
				const animeIndex = tileAnimations[i].getUint16(4, true);
				const animTileset = lzBis(fsext.fmapdata.segments[fsext.fieldAnimeIndices[animeIndex]]);
				const container = {
					nextUpdateTick: undefined,
					startTick: undefined,
					segment: tileAnimations[i],
					tileset: bufToU8(animTileset),
				};

				// only auto-enable if animation is "immediately looping" (flags & 4 == 0, flags & 8 == 0)
				if (!(flags & 0xc)) {
					tileAnimationsDefault.push(container);
					if (options.animations.checked) room.enabledTileAnimations.add(container);
				}
				const check = checkbox('', options.animations.checked && !(flags & 0xc), () => {
					if (check.checked) {
						container.startTick = Math.floor((performance.now() / 1000) * 60);
						room.enabledTileAnimations.add(container);
						if (room.enabledTileAnimations.size === 1) options.animations.set(true, true);
					} else {
						room.enabledTileAnimations.delete(container);
						if (room.enabledTileAnimations.size === 0) options.animations.set(false, true);
					}
					updateTiles = updateMaps = true;
				});
				container.check = check;
				side.tileAnimList.appendChild(check);
			}

			animationsToggledCallback = () => {
				for (const { check } of room.enabledTileAnimations) check.set(false, true);
				room.enabledTileAnimations.clear();
				updatePalettes = updateTiles = updateMaps = true;
				if (!options.animations.checked) return;
				for (const container of tileAnimationsDefault) {
					room.enabledTileAnimations.add(container);
					container.check.set(true, true);
				}
			};

			// side properties map metadata
			if (fsext.fmapmetadata) {
				side.metadataDisplay.innerHTML = 'Metadata:';
				const metadata = bufToU32(fsext.fmapmetadata[options.roomDropdown.value]);
				addHTML(
					side.metadataDisplay,
					`<ul>
				<li>X.b1: ${metadata[0] & 1}</li>
				<li>X.b2: ${metadata[0] & 2}</li>
				<li>X.SELECT map ID: 0x${((metadata[0] >> 2) & 0x3ff).toString(16)}</li>
				<li>X.SELECT map anim: ${(metadata[0] >> 12) & 0x3ff}</li>
				<li>X.variable: ${metadata[0] >> 22}</li>
				<li>Y.unknown: ${metadata[1] & 0x3ffff}</li>
				<li>Y.baseX: ${metadata[1] >> 20}</li>
				<li>Z.baseY: ${metadata[2] & 0xfff}</li>
				<li>Z.musicID: ${metadata[2] >> 12}</li>
			</ul>`,
				);
			}

			// bottom properties
			bottomProperties.innerHTML = '';
			addHTML(
				bottomProperties,
				`<div>Layers: <code>
				BG1 ${indices.l1 !== -1 ? '0x' + indices.l1.toString(16) : '-1'},
				BG2 ${indices.l2 !== -1 ? '0x' + indices.l2.toString(16) : '-1'},
				BG3 ${indices.l3 !== -1 ? '0x' + indices.l3.toString(16) : '-1'},
				Props 0x${indices.props.toString(16)},
				Treasure ${indices.treasure !== -1 ? '0x' + indices.treasure.toString(16) : '-1'}
			</code></div>`,
			);

			const blendingItems = [];
			const blending = unpackSegmented(room.props[8]);
			for (let i = 0; i < blending.length; ++i) {
				blendingItems.push(`<code>${bytes(0, blending[i].byteLength, blending[i])}</code>`);
			}

			const layerAnimationItems = [];
			for (let i = 0, j = 1; j < layerAnimations.length; ++i, j += 3) {
				const segment = layerAnimations[j];
				const second = layerAnimations[j + 1];
				const third = layerAnimations[j + 2];

				let str = `<code>${i}:</code> `;
				if (segment.byteLength >= 8) {
					const x = segment.getUint16(0, true);
					const y = segment.getUint16(2, true);
					const w = segment.getUint16(4, true);
					const h = segment.getUint16(6, true);
					str += `<code>(${x}, ${y})</code> size <code>(${w}, ${h})</code>, `;

					const displays = [];
					for (let j = 0; j < 3; ++j) {
						let tally = 0;
						for (let k = 0; k < w * h; ++k) {
							const tile = segment.getUint16(8 + (j * w * h + k) * 2, true);
							if (tile !== 0x3ff) ++tally;
						}

						if (tally) displays.push(`BG${j + 1} ${Math.round((tally / (w * h)) * 100)}%`);
					}
					str += displays.join(', ');
				} else {
					str += '(no tiles)';
				}

				if (second?.byteLength || third?.byteLength) {
					str += '<ul>';
					if (second?.byteLength)
						str += `<li>second: <code>${bytes(0, second.byteLength, second)}</code></li>`;
					if (third?.byteLength) str += `<li>third: <code>${bytes(0, third.byteLength, third)}</code></li>`;
					str += '</ul>';
				}
				layerAnimationItems.push(str);
			}

			const tileAnimationItems = [];
			for (let i = 0; i < tileAnimations.length; ++i) {
				const segment = tileAnimations[i];
				const flags = segment.getUint32(0, true);
				const animeId = segment.getUint16(4, true);
				const keyframes = segment.getUint16(6, true);

				const parts = [];
				parts.push(`<code>${i}:</code>`);
				parts.push(`BG${(flags & 3) + 1},`);
				parts.push(flags & 8 ? 'scripted' : 'immediately');
				parts.push(flags & 4 ? 'one-shot,' : 'looping,');
				parts.push(`anime <code>0x${animeId.toString(16)}</code>,`);
				parts.push(`${(flags >> 14) & 0x3ff} tiles at <code>0x${((flags >> 4) & 0x3ff).toString(16)}</code>,`);
				parts.push(`${keyframes} keyframes (frame, ticks):`);

				for (let j = 0; j < keyframes; ++j) {
					const frame = segment.getUint16(8 + j * 4, true);
					const ticks = segment.getUint16(8 + j * 4 + 2, true);
					parts.push(`<code style="color: ${j % 2 ? '#999' : '#666'}">(${frame},${ticks})</code>`);
				}

				tileAnimationItems.push(parts.join(' '));
			}

			const lines = [
				`[6] map: <code>${bytes(0, room.map.byteLength, room.map)}</code>`,
				`[7] loadingZones: ${room.loadingZones.byteLength} bytes`,
				`[8] blending: <ul>${blendingItems.map((x) => '<li>' + x + '</li>').join('')}</ul>`,
				`[9] layerAnimations: <ul>${layerAnimationItems.map((x) => '<li>' + x + '</li>').join('')}</ul>`,
				`[10] tileAnimations: <ul>${tileAnimationItems.map((x) => '<li>' + x + '</li>').join('')}</ul>`,
				`[11] paletteAnimations BG1: <ul>${fpaf
					.stringify(room.paletteAnimations[0])
					.map((x) => '<li><code>' + x + '</code></li>')
					.join('')}</ul>`,
				`[12] paletteAnimations BG2: <ul>${fpaf
					.stringify(room.paletteAnimations[1])
					.map((x) => '<li><code>' + x + '</code></li>')
					.join('')}</ul>`,
				`[13] paletteAnimations BG3: <ul>${fpaf
					.stringify(room.paletteAnimations[2])
					.map((x) => '<li><code>' + x + '</code></li>')
					.join('')}</ul>`,
				`[14] collision:`,
				`[15] depth:`,
				`[16] unused: <code>${bytes(0, Math.min(1024, room.props[16].byteLength), room.props[16])}</code>`,
				`[17] unused: <code>${bytes(0, Math.min(1024, room.props[17].byteLength), room.props[17])}</code>`,
			];
			for (const line of lines) addHTML(bottomProperties, '<div>' + line + '</div>');
		};
		roomPicked();

		// i write this boilerplate a LOT so this is a nice shorthand for the devtools console
		field.props = function* () {
			for (let i = 0; i < field.rooms.length; ++i) {
				yield [i, unpackSegmented(lzBis(fsext.fmapdata.segments[field.rooms[i].props]))];
			}
		};

		const palettes = [];
		const render = () => {
			const { room } = field;

			const now = performance.now();
			const tick = Math.floor((now / 1000) * 60);

			const layerWidth = room.map.getUint16(0, true);
			const layerHeight = room.map.getUint16(2, true);
			const layerFlags = bufToU8(room.map);
			const roomHeight = Math.max(layerHeight, room.actualHeight);

			const canvasWidth = options.margins.checked ? layerWidth * 8 : layerWidth * 8 - 32;
			const canvasHeight = options.margins.checked ? roomHeight * 8 : roomHeight * 8 - 32;

			if (options.animations.checked && room.paletteAnimations.some((x) => x.length)) {
				updatePalettes = updateTiles = updateMaps = true;
			}
			if (updatePalettes) {
				for (let i = 0; i < 3; ++i) {
					const ctx = paletteCanvases[i].getContext('2d');
					if (!room.palettes[i]?.byteLength) {
						palettes[i] = room.palettes[i];
						ctx.clearRect(0, 0, 16, 16);
						continue;
					}

					if (options.animations.checked && room.paletteAnimations[i].length) {
						const palette = new Uint32Array(256);
						palette.set(room.palettes[i], 0);
						palettes[i] = palette;
						fpaf.apply(palette, room.paletteAnimations[i], tick);
					} else {
						palettes[i] = room.palettes[i];
					}

					paletteImages[i].data.set(bufToU8(palettes[i]));
					ctx.putImageData(paletteImages[i], 0, 0);
				}
			}

			for (const { nextUpdateTick } of room.enabledTileAnimations) {
				if (nextUpdateTick === undefined || nextUpdateTick <= tick) {
					updateTiles = updateMaps = true;
					break;
				}
			}

			if (updateTiles || updateMaps) {
				const layouts = [new Array(1024), new Array(1024), new Array(1024)];
				for (let i = 0; i < 3; ++i) {
					if (!room.tilesets[i]) continue;
					const tileSize = layerFlags[5] & (1 << i) ? 64 : 32;
					for (let j = 0; j < 1024; ++j) {
						layouts[i][j] = room.tilesets[i].slice(j * tileSize, (j + 1) * tileSize);
					}
				}

				for (const container of room.enabledTileAnimations) {
					const { startTick, segment, tileset } = container;
					const field = segment.getUint32(0, true);
					const layer = field & 3;

					let animationLength = 0;
					const keyframes = segment.getUint16(6, true);
					for (let j = 0; j < keyframes; ++j) animationLength += segment.getUint16(8 + j * 4 + 2, true);

					let animationFrame;
					// (field & 4) means whether the animation is one-shot
					let localTick = field & 4 ? tick - startTick : tick % animationLength;
					for (let i = 0; i < keyframes; ++i) {
						const frame = segment.getUint16(8 + i * 4, true);
						const keyframeLength = segment.getUint16(8 + i * 4 + 2, true);
						if (localTick < keyframeLength) {
							animationFrame = frame;
							container.nextUpdateTick = tick + (keyframeLength - localTick);
							break;
						}
						localTick -= keyframeLength;
					}
					if (animationFrame === undefined) continue;

					const replacementStart = (field >> 4) & 0x3ff;
					const replacementLength = (field >> 14) & 0x3ff;
					const tileSize = layerFlags[5] & (1 << layer) ? 64 : 32;
					for (let i = 0; i < replacementLength; ++i) {
						layouts[layer][replacementStart + i] = tileset.slice(
							(replacementLength * animationFrame + i) * tileSize,
							(replacementLength * animationFrame + i + 1) * tileSize,
						);
					}
				}

				if (updateTiles) {
					for (let i = 0; i < 3; ++i) {
						const ctx = tilesetCanvases[i].getContext('2d');
						if (!room.tilesets[i] || !palettes[i]) {
							ctx.clearRect(0, 0, 256, 256);
							continue;
						}

						const bitmap = bufToU32(tilesetImages[i].data);
						const tileByteSize = layerFlags[5] & (1 << i) ? 64 : 32; // 256-color or 16-color
						const numTiles = Math.ceil(room.tilesets[i].length / tileByteSize);

						bitmap.fill(0, 0, 256 * 256);

						for (let j = 0; j < numTiles; ++j) {
							const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y << 8 | x

							const tile = layouts[i][j];
							if (layerFlags[5] & (1 << i)) {
								// 256-color
								for (let k = 0; k < 64; ++k) {
									const pos = basePos | ((k >> 3) << 8) | (k & 7);
									bitmap[pos] = palettes[i][tile[k] || 0];
								}
							} else {
								// 16-color
								for (let k = 0, o = 0; k < 64; k += 2, ++o) {
									const pos = basePos | ((k >> 3) << 8) | (k & 7);
									const composite = tile[o] || 0;
									bitmap[pos] = palettes[i][composite & 0xf];
									bitmap[pos ^ 1] = palettes[i][composite >> 4];
								}
							}
						}

						ctx.putImageData(tilesetImages[i], 0, 0);
					}
				}

				if (updateMaps) {
					// rooms are always cleared with BG3's 0th color
					mapBitmap.fill(palettes[2][0], 0, layerWidth * roomHeight * 64);

					const mapLayouts = [
						new Uint16Array(layerWidth * roomHeight),
						new Uint16Array(layerWidth * roomHeight),
						new Uint16Array(layerWidth * roomHeight),
					];
					for (let i = 0; i < 3; ++i) {
						for (let j = 0; j < layerWidth * roomHeight; ++j) {
							mapLayouts[i][j] = room.tilemaps[i][j];
						}
					}

					// layer animations first
					for (const { segment } of room.enabledLayerAnimations) {
						const segmentU16 = bufToU16(segment);
						const x = segment.getInt16(0, true);
						const y = segment.getInt16(2, true);
						const w = segment.getInt16(4, true);
						const h = segment.getInt16(6, true);
						for (let i = 0; i < 3; ++i) {
							for (let j = 0; j < w * h; ++j) {
								const jx = j % w;
								const jy = Math.floor(j / w);
								const newTile = segmentU16[4 + i * w * h + j];
								if (newTile !== 0x3ff) mapLayouts[i][(y + jy) * layerWidth + x + jx] = newTile;
							}
						}
					}

					// then draw
					for (let i = 2; i >= 0; --i) {
						if (
							!room.tilemaps[i] ||
							!room.tilesets[i] ||
							!palettes[i] ||
							![options.bg1, options.bg2, options.bg3][i].checked
						)
							continue;
						const layout = mapLayouts[i];

						for (let j = 0; j < layout.length; ++j) {
							const tileX = j % layerWidth;
							const tileY = Math.floor(j / layerWidth);
							const basePos = tileY * 64 * layerWidth + tileX * 8;

							const baseTile = layout[j] & 0x3ff;
							const tile = layouts[i][baseTile];

							const horizontalFlip = layout[j] & 0x400 ? 7 : 0;
							const verticalFlip = layout[j] & 0x800 ? 7 : 0;
							if (layerFlags[5] & (1 << i)) {
								// 256-color
								for (let o = 0; o < 64; ++o) {
									const pos =
										basePos +
										((o >> 3) ^ verticalFlip) * 8 * layerWidth +
										((o & 7) ^ horizontalFlip);
									if (tile[o]) mapBitmap[pos] = palettes[i][tile[o]];
								}
							} else {
								// 16-color
								const paletteShift = (layout[j] >> 12) << 4;
								for (let k = 0, o = 0; k < 64; k += 2, ++o) {
									const pos =
										basePos +
										((k >> 3) ^ verticalFlip) * 8 * layerWidth +
										((k & 7) ^ horizontalFlip);
									const composite = tile[o] || 0;
									if (composite & 0xf) mapBitmap[pos] = palettes[i][paletteShift | (composite & 0xf)];
									if (composite >> 4)
										mapBitmap[pos ^ 1] = palettes[i][paletteShift | (composite >> 4)];
								}
							}
						}
					}

					const imageData = new ImageData(
						bufToU8Clamped(mapBitmap, 0, layerWidth * roomHeight * 64 * 4),
						layerWidth * 8,
						roomHeight * 8,
					);
					const ctx = mapCanvas.getContext('2d');

					mapCanvas.width = canvasWidth;
					mapCanvas.height = canvasHeight;
					if (options.margins.checked) ctx.putImageData(imageData, 0, 0);
					else ctx.putImageData(imageData, -16, -16);
				}
			}

			if (updateOverlay2d) {
				const ctx = map2dOverlay.getContext('2d');
				map2dOverlay.width = canvasWidth;
				map2dOverlay.height = canvasHeight;

				ctx.save();
				ctx.font = 'bold 14px "Red Hat Mono"';

				if (options.treasure.checked) {
					const selectedIndex = side.treasureDropdown.value - 1;
					const treasureSegments = field.treasure[room.indices.treasure] || [];
					for (let i = 0; i < treasureSegments.length; ++i) {
						const treasure = treasureSegments[i];
						const flags = treasure.getUint16(0, true);
						const type = (flags >> 1) & 0xf;
						const x = treasure.getInt16(6, true);
						const y = treasure.getInt16(8, true);
						const z = treasure.getInt16(10, true);

						const drawX = x + (options.margins.checked ? 16 : 0);
						const drawY = y - z + (options.margins.checked ? 16 : 0);

						ctx.fillStyle = selectedIndex === i ? '#fff8' : '#ff08';
						ctx.strokeStyle = '#000';
						ctx.lineWidth = 1;
						ctx.fillRect(drawX - 8, drawY - 8, 16, 16);
						ctx.strokeRect(drawX - 7.5, drawY - 7.5, 15, 15);

						const str = ['B Bean', 'f Block', '-', '-', 'b Block', 'G Grass', '-', 'u Block'][type];
						ctx.fillStyle = selectedIndex === i ? '#888' : '#880';
						ctx.strokeStyle = selectedIndex === i ? '#fff' : '#ff0';
						ctx.lineWidth = 5;
						ctx.strokeText(str, drawX - 4, drawY + 4);
						ctx.fillText(str, drawX - 4, drawY + 4);
					}
				}

				if (options.depth.checked && room.depth.byteLength >= 4) {
					const numDepths = room.depth.getUint32(0, true);
					const enabledLayers =
						!!options.bg1.checked | (!!options.bg2.checked << 1) | (!!options.bg3.checked << 2);
					for (let i = 0, o = 4; i < numDepths; ++i, o += 12) {
						const data = room.depth.getUint16(o, true);
						const flags = room.depth.getUint16(o + 2, true);
						if (!(flags & enabledLayers)) continue; // don't show if none of its layers are drawn

						const x1 = room.depth.getInt16(o + 4, true);
						const x2 = room.depth.getInt16(o + 6, true);
						const y1 = room.depth.getInt16(o + 8, true);
						const y2 = room.depth.getInt16(o + 10, true);

						const drawX = x1 - (options.margins.checked ? 0 : 16);
						const drawY = y1 - (options.margins.checked ? 0 : 16);

						ctx.fillStyle =
							'#' + [0, 1, 2].map((i) => (flags & enabledLayers & (1 << i) ? 'f' : '6')).join('') + '8';
						ctx.strokeStyle = '#000';
						ctx.lineWidth = 1;
						ctx.fillRect(drawX, drawY, x2 - x1, y2 - y1);
						ctx.strokeRect(drawX + 0.5, drawY + 0.5, x2 - x1 - 1, y2 - y1 - 1);

						ctx.fillStyle =
							'#' + [0, 1, 2].map((i) => (flags & enabledLayers & (1 << i) ? 'f' : '6')).join('');
						ctx.lineWidth = 5;
						ctx.strokeText(str16(data), drawX + 5, drawY + 15);
						ctx.fillText(str16(data), drawX + 5, drawY + 15);
					}
				}

				ctx.restore();
			}

			if (updateOverlay3d) {
				const gl = map3dOverlay.getContext('webgl2');
				map3dOverlay.width = canvasWidth;
				map3dOverlay.height = canvasHeight;
				gl.viewport(0, 0, canvasWidth, canvasHeight);

				gl.enable(gl.DEPTH_TEST);
				gl.depthFunc(gl.LEQUAL);

				gl.clearColor(0, 0, 0, 0);
				gl.clearDepth(1);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

				if (updateOverlay3dTriangles) {
					vertexFloatsUsed = 0;
					let minX, maxX, minY, maxY, minZ, maxZ;
					const vertex = (xyz, rgb) => {
						if (vertexFloatsUsed * 7 + 6 >= vertexFloats.length) {
							// resize float array as necessary
							const old = vertexFloats;
							vertexFloats = new Float32Array(old.length * 2);
							vertexFloats.set(old, 0);
						}

						vertexFloats.set([xyz[0], xyz[1], xyz[2], rgb[0], rgb[1], rgb[2], 1], vertexFloatsUsed * 7);

						if (!vertexFloatsUsed || xyz[0] < minX) minX = xyz[0];
						if (!vertexFloatsUsed || maxX < xyz[0]) maxX = xyz[0];
						if (!vertexFloatsUsed || xyz[1] < minY) minY = xyz[1];
						if (!vertexFloatsUsed || maxY < xyz[1]) maxY = xyz[1];
						if (!vertexFloatsUsed || xyz[2] < minZ) minZ = xyz[2];
						if (!vertexFloatsUsed || maxZ < xyz[2]) maxZ = xyz[2];
						++vertexFloatsUsed;
					};

					const tri = (v1, v2, v3, rgb) => {
						vertex(v1, rgb);
						vertex(v2, rgb);
						vertex(v3, rgb);
					};

					/** v1 -> v4 should go around in a circle, clockwise or counter-clockwise */
					const quad = (v1, v2, v3, v4, rgb) => {
						tri(v1, v2, v3, rgb);
						tri(v3, v4, v1, rgb);
					};

					const cube = (b1, b2, b3, b4, t1, t2, t3, t4, rgb1, rgb2, rgb3, rgb4, rgb5, rgb6) => {
						quad(b1, b2, b3, b4, rgb1);
						quad(b1, b2, t2, t1, rgb2);
						quad(b2, b3, t3, t2, rgb3);
						quad(b3, b4, t4, t3, rgb4);
						quad(b1, b4, t4, t1, rgb5);
						quad(t1, t2, t3, t4, rgb6);
					};

					const prism = (b1, b2, b3, t1, t2, t3, rgb1, rgb2, rgb3, rgb4, rgb5) => {
						tri(b1, b2, b3, rgb1);
						quad(b1, b2, t2, t1, rgb2);
						quad(b2, b3, t3, t2, rgb3);
						quad(b1, b3, t3, t2, rgb4);
						tri(t1, t2, t3, rgb5);
					};

					if (options.collision.checked) {
						// loading zones
						const selectedLoadingZone =
							(side.loadingZoneDropdown.hovered ?? side.loadingZoneDropdown.value) - 1;
						for (let i = 0, o = 0; o < room.loadingZones.byteLength; ++i, o += 24) {
							const flags = room.loadingZones.getUint16(o, true);
							const x1 = room.loadingZones.getInt16(o + 4, true);
							const y1 = room.loadingZones.getInt16(o + 6, true);
							const z = room.loadingZones.getInt16(o + 8, true);
							const x2 = room.loadingZones.getInt16(o + 10, true);
							const y2 = room.loadingZones.getInt16(o + 12, true);

							const baseColor = selectedLoadingZone === i ? [0, 0, 1] : [1, 0, 1];
							const frontColor = selectedLoadingZone === i ? [0.5, 0.5, 1] : [1, 0.5, 1];

							const colors = [baseColor, baseColor, baseColor, baseColor, baseColor, baseColor];
							const direction = (flags >> 2) & 3;
							// [3, 4, 1, 2] <=> [upwards, rightwards, downwards, leftwards] exit
							colors[[3, 4, 1, 2][direction]] = frontColor;
							// upwards: x1 +>, prefer lower y => color 1
							// downwards: x1 +>, prefer higher y => color 3
							// leftwards: prefer lower x, y1 +> => color 4
							// rightwards: prefer higher x, y1 +> => color 2

							cube(
								[x1, y1, z],
								[x1 + x2, y1, z],
								[x1 + x2, y1 + y2, z],
								[x1, y1 + y2, z],
								[x1, y1, z + 24],
								[x1 + x2, y1, z + 24],
								[x1 + x2, y1 + y2, z + 24],
								[x1, y1 + y2, z + 24],
								...colors,
							);
						}

						// actual collision
						if (room.collision.byteLength > 0) {
							const numPrisms = room.collision.getUint32(0, true);
							const numSpecials = room.collision.getUint32(4, true);
							const selectedPrism = (side.collisionDropdown.hovered ?? side.collisionDropdown.value) - 1;

							let o = 8;
							for (let i = 0; i < numPrisms; ++i, o += 40) {
								const flags1 = room.collision.getUint16(o, true);
								const flags2 = room.collision.getUint16(o + 2, true);
								const flags3 = room.collision.getUint16(o + 4, true);
								const flags4 = room.collision.getUint16(o + 6, true);

								const fourPointed = flags1 & 8;
								const top = [];
								const bottom = [];
								for (let j = 0; j < (fourPointed ? 4 : 3); ++j) {
									const x = room.collision.getInt16(o + 8 + j * 8, true);
									const y = room.collision.getInt16(o + 8 + j * 8 + 2, true);
									const z1 = room.collision.getInt16(o + 8 + j * 8 + 4, true);
									const z2 = room.collision.getInt16(o + 8 + j * 8 + 6, true);
									top.push([x, y, z1]);
									bottom.push([x, y, z2]);
								}

								const flat =
									bottom[0][2] === top[0][2] &&
									bottom[1][2] === top[1][2] &&
									bottom[2][2] === top[2][2] &&
									bottom[3]?.[2] === top[3]?.[2];

								let color = [1, 1, 1];
								if (flags3 !== 0xffff) color = [0, 1, 1]; // not solid in at least one action
								if (flags4 & 1) color = [1, 0, 0]; // can't enter
								if (flags4 & 0xfffc) color = [1, 0.6, 0.1]; // strange attributes (unisolid, grippy, ..)

								if (selectedPrism === i) color = [0, 0, 1];

								// random-ish but predictable shading, so depth is way easier to see
								const rotr8 = (x, r) => (x >> r) | (x << (8 - r));
								const multiplier =
									0.9 + (((rotr8(i, 1) ^ rotr8(i, 3) ^ rotr8(i, 6)) & 0xff) / 0xff) * 0.1;
								color = color.map((x) => x * multiplier);

								const midColor = color.map((x) => x * 0.8);
								const lowColor = color.map((x) => x * 0.6);

								if (flat) {
									if (fourPointed) quad(...bottom, color);
									else tri(...bottom, color);
								} else if (fourPointed) {
									cube(...bottom, ...top, lowColor, midColor, midColor, midColor, midColor, color);
								} else {
									prism(...bottom, ...top, lowColor, midColor, midColor, midColor, color);
								}
							}

							for (let i = 0; i < numSpecials; ++i, o += 24) {
								const x1 = room.collision.getUint16(o + 4, true);
								const x2 = room.collision.getUint16(o + 6, true);
								const y1 = room.collision.getUint16(o + 8, true);
								const y2 = room.collision.getUint16(o + 10, true);
								const z = room.collision.getUint16(o + 12, true);
								quad([x1, y1, z], [x2, y1, z], [x2, y2, z], [x1, y2, z], [0.25, 1, 0.25]);
							}
						}
					}

					gl.bindBuffer(gl.ARRAY_BUFFER, map3d.buffer);
					gl.bufferData(gl.ARRAY_BUFFER, vertexFloats, gl.STATIC_DRAW);

					gl.uniform3f(map3d.uniforms.pivot, (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
				}

				const sinX = Math.sin(map3d.rotX());
				const cosX = Math.cos(map3d.rotX());
				const sinY = Math.sin(map3d.rotY());
				const cosY = Math.cos(map3d.rotY());
				gl.uniformMatrix3fv(
					map3d.uniforms.rotation1,
					false,
					new Float32Array([cosX, sinX, 0, -sinX, cosX, 0, 0, 0, 1]),
				);
				gl.uniformMatrix3fv(
					map3d.uniforms.rotation2,
					false,
					new Float32Array([1, 0, 0, 0, cosY, sinY, 0, -sinY, cosY]),
				);
				if (options.margins.checked) gl.uniform3f(map3d.uniforms.translation, 8, 8, 0);
				else gl.uniform3f(map3d.uniforms.translation, 0, 0, 0);
				gl.uniform2f(map3d.uniforms.canvasSize, canvasWidth, canvasHeight);

				if (vertexFloatsUsed) gl.drawArrays(gl.TRIANGLES, 0, vertexFloatsUsed);
			}

			updatePalettes = updateTiles = updateMaps = updateOverlay2d = false;
			updateOverlay3d = updateOverlay3dTriangles = false;

			requestAnimationFrame(render);
		};
		render();

		const exportPng = () => {
			const room = field.rooms[options.roomDropdown.value];
			const props = unpackSegmented(lzBis(fsext.fmapdata.segments[room.props]));
			const tilemaps = [props[0], props[1], props[2]].map((buf) => bufToU16(buf));
			const palettes = [props[3], props[4], props[5]].map((buf) => rgb15To32(bufToU16(buf)));

			const layerWidth = props[6].getUint16(0, true);
			const layerHeight = props[6].getUint16(2, true);
			const layerFlags = props[6].getUint8(5);
			const actualHeight = Math.max(
				Math.max(tilemaps[0].length, tilemaps[1].length, tilemaps[2].length) / layerWidth,
				layerHeight,
			);

			const inset = options.margins.checked ? 0 : 2;
			const imageWidth = (layerWidth - inset * 2) * 8;
			const imageHeight = (actualHeight - inset * 2) * 8;

			const bitmap = new Uint32Array(imageWidth * imageHeight);
			bitmap.fill(palettes[2][0], 0, bitmap.length);
			for (let i = 2; i >= 0; --i) {
				if (![options.bg1, options.bg2, options.bg3][i].checked || [room.l1, room.l2, room.l3][i] === -1) continue;
				const palette = palettes[i];
				const tilemap = tilemaps[i];
				if (!tilemap.byteLength || !palette.byteLength) continue;
				const tileset = bufToU8(lzBis(fsext.fmapdata.segments[[room.l1, room.l2, room.l3][i]]));

				let tilemapOff = 0;
				for (let x = inset; x < layerWidth - inset; ++x) {
					for (let y = inset; y < actualHeight - inset; ++y) {
						const tile = tilemap[y * layerWidth + x];
						if (tile === undefined) continue;
						const basePos = (y - inset) * imageWidth * 8 + (x - inset) * 8;
						const horizontalFlip = tile & 0x400 ? 7 : 0;
						const verticalFlip = tile & 0x800 ? 7 : 0;
						if (layerFlags & (1 << i)) {
							// 256-color
							const tilesetOff = (tile & 0x3ff) * 64;
							for (let o = 0; o < 64; ++o) {
								const pos
									= basePos + ((o >> 3) ^ verticalFlip) * imageWidth + ((o & 7) ^ horizontalFlip);
								if (tileset[tilesetOff + o]) bitmap[pos] = palette[tileset[tilesetOff + o]];
							}
						} else {
							// 16-color
							const paletteShift = (tile >> 12) << 4;
							const tilesetOff = (tile & 0x3ff) * 32;
							for (let k = 0, o = 0; k < 64; k += 2, ++o) {
								const pos
									= basePos + ((k >> 3) ^ verticalFlip) * imageWidth + ((k & 7) ^ horizontalFlip);
								const composite = tileset[tilesetOff + o] || 0;
								if (composite & 0xf) bitmap[pos] = palette[paletteShift | (composite & 0xf)];
								if (composite >> 4) bitmap[pos ^ 1] = palette[paletteShift | (composite >> 4)];
							}
						}
					}
				}
			}

			console.log(bitmap, layerWidth, actualHeight);

			console.log(bitmap);
			download(`fmap-${str16(options.roomDropdown.value)}.png`, png(bitmap, imageWidth, imageHeight), 'image/png');
		};

		return field;
	}));
};