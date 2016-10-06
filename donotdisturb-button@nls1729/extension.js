/*
  Copyright (c) 2015-2016 Norman L. Smith

  This file is part of the Do Not Disturb Extension donotdisturb-button@nls1729.

  The extension is free software; you can redistribute it and/or modify it
  under the terms of the GNU General Public Licenseas published by the Free
  Software Foundation; either version 2 of the License, or (at your option)
  any later version.  The extension is distributed in the hope it will be
  useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
  Public License for more details.  You should have received a copy of the
  GNU General Public License along with the extension.  If not, see
  <http://www.gnu.org/licenses/>.

  This extension is a derived work of the Gnome Shell.
*/

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const GnomeSession = imports.misc.gnomeSession;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const SHORTCUT = 'shortcut';


const DoNotDisturbButton = new Lang.Class({
    Name:'DoNotDisturbButton',
    Extends:PanelMenu.Button,

    _init: function(settings) {
        this.parent(0.5, null, true);
        this._settings = settings;
        this._iconAvailable = new St.Icon({icon_name: 'user-available-symbolic', style_class: 'system-status-icon'});
        this._iconBusy = new St.Icon({icon_name: 'user-busy-symbolic', style_class: 'system-status-icon'});
        this._layoutBox = new St.BoxLayout();
        this._layoutBox.add_actor(this._iconAvailable);
        this._layoutBox.add_actor(this._iconBusy);
        this.actor.add_actor(this._layoutBox);
        this._toggle = true;
        this._btnReleaseSig = this.actor.connect_after('button-release-event', Lang.bind(this, this._onButtonRelease));
        this._keyReleaseSig = this.actor.connect_after('key-release-event', Lang.bind(this, this._onKeyRelease));      
        this._presence = new GnomeSession.Presence(Lang.bind(this, function(proxy, error) {
            this._onStatusChanged(proxy.status);          
        }));
        this._statusChangedSig = this._presence.connectSignal('StatusChanged', Lang.bind(this, function(proxy, senderName, [status]) {
            this._onStatusChanged(status);
        }));
        this._changedSettingsSig = this._settings.connect("changed::shortcut", Lang.bind(this, function() {
            this._removeKeybinding();
            this._addKeybinding();
        }));
        this._addKeybinding();
    },

    _onStatusChanged: function(status) {
        if (status == GnomeSession.PresenceStatus.BUSY) {
            this._toggle = false;
            this._iconAvailable.hide();
            this._iconBusy.show();
        } else {
            this._toggle = true;
            this._iconBusy.hide();
            this._iconAvailable.show();
        }
    },

    _onButtonRelease:function(actor, event) {
        this._togglePresence();
        return Clutter.EVENT_STOP;
    },

    _onKeyRelease: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_Return || symbol == Clutter.KEY_space) {
            this._togglePresence();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _togglePresence: function() {
        if (this._toggle) {
            this._updatePresense(false);  
        } else {
            this._updatePresense(true); 
        }
        this._toggle = !this._toggle;
    },

    _updatePresense: function(state) {
        let status = state ? GnomeSession.PresenceStatus.AVAILABLE : GnomeSession.PresenceStatus.BUSY;
        this._presence.SetStatusRemote(status);
    },

    _removeKeybinding: function() {
        Main.wm.removeKeybinding(SHORTCUT);
    },

    _addKeybinding: function() {
        Main.wm.addKeybinding(SHORTCUT, this._settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, Lang.bind(this, this._togglePresence));
    },
   
    destroy: function() {
        this._removeKeybinding();
        this.actor.disconnect(this._btnReleaseSig);
        this.actor.disconnect(this._keyReleaseSig);
        this._presence.disconnectSignal(this._statusChangedSig);
        this._settings.disconnect(this._changedSettingsSig);
        this.actor.get_children().forEach(function(c) { c.destroy(); });
        this.parent();
    }

});

const DoNotDisturbExtension = new Lang.Class({
    Name:'DoNotDisturbExtension',

    _init: function() {
        this._btn = null;
        let GioSSS = Gio.SettingsSchemaSource;
        let schema = Me.metadata['settings-schema'];
        let schemaDir = Me.dir.get_child('schemas').get_path();
        let schemaSrc = GioSSS.new_from_directory(schemaDir, GioSSS.get_default(), false);
        let schemaObj = schemaSrc.lookup(schema, true);
        this._settings = new Gio.Settings({ settings_schema: schemaObj });
    },

    destroy: function() {
        if (this._btn != null) {
            this._btn.destroy();
            this._btn = null;
        }
    },

    enable: function() {
        this._btn = new DoNotDisturbButton(this._settings);
        Main.panel.addToStatusArea('DoNotDistrub', this._btn, 0, 'right');
    },

    disable: function() {
        if (this._btn != null) {
            this._btn.destroy();
            this._btn = null;
        }
    }

});

function init(metadata) {
    return new DoNotDisturbExtension();
}
