
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-sms-tool
LUCI_TITLE:=LuCI SMS Tool
LUCI_DESCRIPTION:=SMS send/receive tool with SIM and modem memory storage, \
	configurable send/receive ports
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+sms-tool
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
