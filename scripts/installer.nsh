!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
  Var WarpConsent
  Var WarpLicenseText
  Var WarpLicenseLine
  Var WarpLicenseFile

  !macro customWelcomePage
    Page custom WarpLicensePage WarpLicenseLeave
  !macroend

  # Expand after electron-builder has initialized MUI and the selected languages.
  !macro customHeader
  LangString WarpLicenseTitle ${LANG_ENGLISH} "MIT license"
  LangString WarpLicenseTitle ${LANG_VIETNAMESE} "Giấy phép MIT"
  LangString WarpLicenseSubtitle ${LANG_ENGLISH} "Please read and accept the license before installing Warp."
  LangString WarpLicenseSubtitle ${LANG_VIETNAMESE} "Đọc và đồng ý giấy phép trước khi cài Warp."
  LangString WarpLicenseLink ${LANG_ENGLISH} "Read the MIT license on GitHub (opens your browser)"
  LangString WarpLicenseLink ${LANG_VIETNAMESE} "Xem giấy phép MIT trên GitHub (mở trình duyệt)"
  LangString WarpLicenseAccept ${LANG_ENGLISH} "I have read and agree to the MIT license."
  LangString WarpLicenseAccept ${LANG_VIETNAMESE} "Tôi đã đọc và đồng ý với giấy phép MIT."
  LangString WarpLicenseRequired ${LANG_ENGLISH} "Accept the MIT license to continue."
  LangString WarpLicenseRequired ${LANG_VIETNAMESE} "Hãy đồng ý giấy phép MIT để tiếp tục."

  Function WarpLicensePage
    !insertmacro MUI_HEADER_TEXT "$(WarpLicenseTitle)" "$(WarpLicenseSubtitle)"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    InitPluginsDir
    File /oname=$PLUGINSDIR\warp-license.txt "${PROJECT_DIR}\LICENSE"
    StrCpy $WarpLicenseText ""
    FileOpen $WarpLicenseFile "$PLUGINSDIR\warp-license.txt" r
    license_read:
      ClearErrors
      FileRead $WarpLicenseFile $WarpLicenseLine
      IfErrors license_done
      StrCpy $WarpLicenseText "$WarpLicenseText$WarpLicenseLine"
      Goto license_read
    license_done:
    FileClose $WarpLicenseFile
    nsDialogs::CreateControl "EDIT" "${WS_VISIBLE}|${WS_CHILD}|${WS_TABSTOP}|${WS_VSCROLL}|${ES_MULTILINE}|${ES_AUTOVSCROLL}|${ES_READONLY}" "${WS_EX_CLIENTEDGE}" 0 0 100% 105u "$WarpLicenseText"
    Pop $0
    ${NSD_CreateLink} 0 112u 100% 15u "$(WarpLicenseLink)"
    Pop $0
    ${NSD_OnClick} $0 WarpOpenLicense
    ${NSD_CreateCheckbox} 0 137u 100% 20u "$(WarpLicenseAccept)"
    Pop $WarpConsent
    ${NSD_OnClick} $WarpConsent WarpConsentClicked
    Call WarpConsentChanged
    nsDialogs::Show
  FunctionEnd

  Function WarpConsentChanged
    ${NSD_GetState} $WarpConsent $0
    GetDlgItem $1 $HWNDPARENT 1
    ${If} $0 == ${BST_CHECKED}
      EnableWindow $1 1
    ${Else}
      EnableWindow $1 0
    ${EndIf}
  FunctionEnd

  Function WarpConsentClicked
    Pop $0
    Call WarpConsentChanged
  FunctionEnd

  Function WarpOpenLicense
    Pop $0
    ExecShell "open" "https://github.com/HuangKha097/Warp/blob/main/LICENSE"
  FunctionEnd

  Function WarpLicenseLeave
    ${NSD_GetState} $WarpConsent $0
    ${If} $0 != ${BST_CHECKED}
      MessageBox MB_ICONEXCLAMATION "$(WarpLicenseRequired)"
      Abort
    ${EndIf}
  FunctionEnd
  !macroend
!endif

# The app manages HKCU Run after first launch. Upgrades preserve the user's choice.
!macro customInstall
  FileOpen $0 "$INSTDIR\installer-language" w
  ${If} $LANGUAGE == 1066
    FileWrite $0 "vi"
  ${Else}
    FileWrite $0 "en"
  ${EndIf}
  FileClose $0
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Warp"
!macroend
