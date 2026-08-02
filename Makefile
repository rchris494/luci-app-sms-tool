
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-sms-tool
LUCI_TITLE:=LuCI SMS Tool
LUCI_DESCRIPTION:=SMS send/receive tool with SIM and modem memory storage, \
	configurable send/receive ports
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+sms-tool
PKG_VERSION:=1.0.0
PKG_RELEASE:=5

define Package/luci-app-sms-tool/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/sms-tool enable 2>/dev/null
	/etc/init.d/sms-tool start 2>/dev/null
	# rpcd must reload to pick up the new ubus methods/ACL.
	/etc/init.d/rpcd reload 2>/dev/null
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
