'use strict';
'require view';

return view.extend({
	title: _('Sent'),
	order: 30,

	load: function() { return Promise.resolve(); },

	render: function() {
		function esc(s) {
			return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
		}

		var tbody = E('tbody', {});

		function loadSent() {
			var sent = JSON.parse(localStorage.getItem('sms_sent') || '[]');
			tbody.innerHTML = '';
			if (!sent.length) {
				tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2em;color:#888;">' + _('No sent messages recorded.') + '</td></tr>';
				return;
			}
			sent.slice().reverse().forEach(function(m, i) {
				var tr = document.createElement('tr');
				tr.className = 'tr cbi-rowstyle-' + ((i % 2) + 1);
				tr.innerHTML =
					'<td class="td">' + esc(m.number) + '</td>' +
					'<td class="td" style="white-space:nowrap;font-size:.85em;">' + esc(m.ts) + '</td>' +
					'<td class="td" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(m.body) + '</td>' +
					'<td class="td" style="font-size:.8em;">' + esc(m.mr || '—') + '</td>';
				tbody.appendChild(tr);
			});
		}

		var clearBtn = E('button', { class: 'btn cbi-button cbi-button-remove', style: 'margin-bottom:1em;' }, _('Clear Sent Log'));
		clearBtn.addEventListener('click', function() {
			if (!confirm(_('Clear all sent message history?'))) return;
			localStorage.removeItem('sms_sent');
			loadSent();
		});

		window.addEventListener('storage', function(e) {
			if (e.key === 'sms_sent') loadSent();
		});

		loadSent();

		return E('div', {}, [
			E('p', { style: 'font-size:.85em;color:#888;margin-bottom:1em;' }, _('Sent messages are stored in the router\'s local cache.')),
			clearBtn,
			E('table', { class: 'table cbi-section-table' }, [
				E('thead', {}, E('tr', { class: 'tr table-titles' }, [
					E('th', { class: 'th' }, _('To')),
					E('th', { class: 'th' }, _('Sent at')),
					E('th', { class: 'th' }, _('Message')),
					E('th', { class: 'th' }, _('Ref'))
				])),
				tbody
			])
		]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null
});
