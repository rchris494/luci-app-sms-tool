'use strict';
'require view';
'require rpc';
'require ui';

var callRead     = rpc.declare({ object: 'luci.sms-tool', method: 'read',     params: ['storage'] });
var callDelete   = rpc.declare({ object: 'luci.sms-tool', method: 'delete',   params: ['index', 'storage'] });
var callStorage  = rpc.declare({ object: 'luci.sms-tool', method: 'storage'   });
var callGetState = rpc.declare({ object: 'luci.sms-tool', method: 'get_state' });
var callSetView  = rpc.declare({ object: 'luci.sms-tool', method: 'set_view', params: ['storage'] });

return view.extend({
	title: _('Inbox'),
	order: 10,

	load: function() {
		// Restore the persisted view-storage so the dropdown stays where the
		// user left it across reloads and navigation.
		return callGetState().catch(function() { return {}; });
	},

	render: function(state) {
		state = state || {};
		var valid = { SM: 1, ME: 1, MT: 1 };
		var initialStorage = valid[state.view_storage] ? state.view_storage
		                   : (valid[state.storage] ? state.storage : 'SM');

		var currentStorage = initialStorage;
		var allMessages = [];
		var selectedMsg = null;

		function esc(s) {
			return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
		}

		function storageLabel(s) {
			return s === 'SM' ? 'SIM' : s === 'ME' ? 'Modem' : s;
		}

		function renderRows(msgs, tbody) {
			tbody.innerHTML = '';
			if (!msgs.length) {
				tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2em;color:#888;">' + _('No messages in this storage') + '</td></tr>';
				return;
			}
			msgs.forEach(function(m, i) {
				var unread = m.status && m.status.indexOf('UNREAD') >= 0;
				var tr = document.createElement('tr');
				tr.className = 'tr cbi-rowstyle-' + ((i % 2) + 1);
				tr.innerHTML =
					'<td class="td" style="' + (unread ? 'font-weight:bold;' : '') + '">' + esc(m.from || '—') + '</td>' +
					'<td class="td" style="white-space:nowrap;font-size:.85em;">' + esc(m.timestamp || '') + '</td>' +
					'<td class="td" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(m.body || '') + '</td>' +
					'<td class="td" style="font-size:.8em;">' + storageLabel(m.storage || currentStorage) + '</td>' +
					'<td class="td" style="white-space:nowrap;">' +
						'<button class="btn cbi-button view-btn" data-i="' + i + '">' + _('View') + '</button> ' +
						'<button class="btn cbi-button cbi-button-action reply-btn" data-from="' + esc(m.from || '') + '">' + _('Reply') + '</button> ' +
						'<button class="btn cbi-button cbi-button-remove del-btn" data-i="' + i + '" data-idx="' + (m.index != null ? m.index : -1) + '" data-stor="' + esc(m.storage || currentStorage) + '">' + _('Del') + '</button>' +
					'</td>';
				tbody.appendChild(tr);
			});
		}

		var storInfo = E('span', { style: 'margin-left:auto;font-size:0.85em;color:#888;' });

		function loadMessages(storage, tbody) {
			tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2em;">' + _('Loading…') + '</td></tr>';
			currentStorage = storage;
			// Viewing only: read from the selected storage. This sets the modem's
			// read pointer (mem1) but NOT the incoming store (mem3), so browsing
			// the SIM inbox no longer reroutes new messages to the SIM.
			callRead(storage).then(function(d) {
				allMessages = (d && d.messages) ? d.messages : [];
				renderRows(allMessages, tbody);
				return callStorage();
			}).then(function(d) {
				if (d && d.sim && d.modem)
					storInfo.textContent = _('SIM:') + ' ' + d.sim.used + '/' + d.sim.total +
						'  ' + _('Modem:') + ' ' + d.modem.used + '/' + d.modem.total;
			}).catch(function() {});
		}

		var storSel    = E('select', { class: 'cbi-input-select' }, [
			E('option', { value: 'SM' }, 'SM – ' + _('SIM card')),
			E('option', { value: 'ME' }, 'ME – ' + _('Modem memory')),
			E('option', { value: 'MT' }, 'MT – ' + _('All (SIM + Modem)'))
		]);
		// Restore the persisted selection.
		storSel.value = initialStorage;
		var refreshBtn = E('button', { class: 'btn cbi-button' }, '↻ ' + _('Refresh'));
		var storBar    = E('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:1em;' },
			[ E('label', {}, _('Storage:')), storSel, refreshBtn, storInfo ]);

		var tbody = E('tbody', {}, [
			E('tr', {}, E('td', { colspan: '5', style: 'text-align:center;padding:2em;' }, _('Loading…')))
		]);
		var table = E('table', { class: 'table cbi-section-table' }, [
			E('thead', {}, E('tr', { class: 'tr table-titles' }, [
				E('th', { class: 'th' }, _('From')),
				E('th', { class: 'th' }, _('Date / Time')),
				E('th', { class: 'th' }, _('Message')),
				E('th', { class: 'th' }, _('Storage')),
				E('th', { class: 'th', style: 'min-width:200px;' }, _('Actions'))
			])),
			tbody
		]);

		var modalFrom      = E('h3', { style: 'margin:0 0 .5em;color:var(--color-text-primary);' });
		var modalTs        = E('p',  { style: 'font-size:.8em;color:var(--color-text-secondary);margin:0 0 1em;' });
		var modalBody      = E('p',  { style: 'white-space:pre-wrap;word-break:break-word;color:var(--color-text-primary);background:var(--color-background-secondary);padding:10px;border-radius:4px;' });
		var modalReplyBtn  = E('button', { class: 'btn cbi-button cbi-button-action' }, _('Reply'));
		var modalDeleteBtn = E('button', { class: 'btn cbi-button cbi-button-remove' }, _('Delete'));
		var modalCloseBtn  = E('button', { class: 'btn cbi-button' }, _('Close'));
		var modal = E('div', { style: 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center;' }, [
			E('div', { style: 'background:var(--color-background-primary);border:1px solid #4a5568;border-radius:6px;padding:1.5em;max-width:480px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,.5);' }, [
				modalFrom, modalTs, modalBody,
				E('div', { style: 'display:flex;gap:8px;margin-top:1em;' }, [ modalReplyBtn, modalDeleteBtn, modalCloseBtn ])
			])
		]);

		function openMsg(i) {
			selectedMsg = allMessages[i];
			modalFrom.textContent = selectedMsg.from || _('Unknown sender');
			modalTs.textContent   = selectedMsg.timestamp || '';
			modalBody.textContent = selectedMsg.body || '';
			modal.style.display   = 'flex';
		}

		function doDelete(index, storage) {
			if (!confirm(_('Delete this message?'))) return;
			callDelete(index, storage || currentStorage).then(function(d) {
				if (d && d.success) loadMessages(currentStorage, tbody);
				else ui.addNotification(null, E('p', _('Delete failed: ') + ((d && d.error) || '')), 'error');
			});
		}

		tbody.addEventListener('click', function(e) {
			var btn = e.target.closest('button');
			if (!btn) return;
			var i = parseInt(btn.dataset.i);
			if (btn.classList.contains('view-btn'))        openMsg(i);
			else if (btn.classList.contains('del-btn'))    doDelete(parseInt(btn.dataset.idx), btn.dataset.stor);
			else if (btn.classList.contains('reply-btn'))  window.location.href = L.url('admin/modem/luci-app-sms-tool/compose') + '?to=' + encodeURIComponent(btn.dataset.from);
		});

		modalCloseBtn.addEventListener('click',  function() { modal.style.display = 'none'; });
		modalDeleteBtn.addEventListener('click', function() {
			if (!selectedMsg) return;
			modal.style.display = 'none';
			doDelete(selectedMsg.index != null ? selectedMsg.index : -1, selectedMsg.storage);
		});
		modalReplyBtn.addEventListener('click', function() {
			var number = selectedMsg ? (selectedMsg.from || '') : '';
			window.location.href = L.url('admin/modem/luci-app-sms-tool/compose') + '?to=' + encodeURIComponent(number);
		});

		refreshBtn.addEventListener('click', function() { loadMessages(storSel.value, tbody); });
		storSel.addEventListener('change',   function() {
			var v = storSel.value;
			// Persist the view choice so it survives reloads/navigation. This
			// does NOT touch the modem's incoming store.
			callSetView(v).catch(function() {});
			loadMessages(v, tbody);
		});

		loadMessages(initialStorage, tbody);
		setInterval(function() { loadMessages(storSel.value, tbody); }, 60000);

		return E('div', {}, [ storBar, table, modal ]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null
});
