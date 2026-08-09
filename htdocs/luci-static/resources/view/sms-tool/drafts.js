'use strict';
'require view';

return view.extend({
	title: _('Drafts'),
	order: 40,

	load: function() { return Promise.resolve(); },

	render: function() {
		function esc(s) {
			return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
		}

		var tbody = E('tbody', {});

		function loadDrafts() {
			var drafts = JSON.parse(localStorage.getItem('sms_drafts') || '[]');
			tbody.innerHTML = '';
			if (!drafts.length) {
				tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2em;color:#888;">' + _('No drafts saved.') + '</td></tr>';
				return;
			}
			drafts.forEach(function(d, i) {
				var tr = document.createElement('tr');
				tr.className = 'tr cbi-rowstyle-' + ((i % 2) + 1);
				tr.innerHTML =
					'<td class="td">' + esc(d.number) + '</td>' +
					'<td class="td" style="white-space:nowrap;font-size:.85em;">' + esc(d.saved) + '</td>' +
					'<td class="td" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(d.body) + '</td>' +
					'<td class="td">' +
						'<button class="btn cbi-button cbi-button-action edit-btn" data-i="' + i + '">' + _('Edit') + '</button> ' +
						'<button class="btn cbi-button cbi-button-remove del-btn"  data-i="' + i + '">' + _('Del')  + '</button>' +
					'</td>';
				tbody.appendChild(tr);
			});
		}

		tbody.addEventListener('click', function(e) {
			var btn = e.target.closest('button');
			if (!btn) return;
			var i = parseInt(btn.dataset.i);
			var drafts = JSON.parse(localStorage.getItem('sms_drafts') || '[]');

			if (btn.classList.contains('edit-btn')) {
				var d = drafts[i];
				if (!d) return;
				drafts.splice(i, 1);
				localStorage.setItem('sms_drafts', JSON.stringify(drafts));
				window.location.href = L.url('admin/modem/luci-app-sms-tool/compose') +
					'?to='   + encodeURIComponent(d.number) +
					'&body=' + encodeURIComponent(d.body);
			} else if (btn.classList.contains('del-btn')) {
				if (!confirm(_('Delete this draft?'))) return;
				drafts.splice(i, 1);
				localStorage.setItem('sms_drafts', JSON.stringify(drafts));
				loadDrafts();
			}
		});

		var clearBtn = E('button', { class: 'btn cbi-button cbi-button-remove', style: 'margin-bottom:1em;' }, _('Clear All Drafts'));
		clearBtn.addEventListener('click', function() {
			if (!confirm(_('Delete all drafts?'))) return;
			localStorage.removeItem('sms_drafts');
			loadDrafts();
		});

		loadDrafts();

		return E('div', {}, [
			E('p', { style: 'font-size:.85em;color:#888;margin-bottom:1em;' }, _('Drafts are saved in your browser\'s local storage.')),
			clearBtn,
			E('table', { class: 'table cbi-section-table' }, [
				E('thead', {}, E('tr', { class: 'tr table-titles' }, [
					E('th', { class: 'th' }, _('To')),
					E('th', { class: 'th' }, _('Saved at')),
					E('th', { class: 'th' }, _('Message')),
					E('th', { class: 'th' }, _('Actions'))
				])),
				tbody
			])
		]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null
});
