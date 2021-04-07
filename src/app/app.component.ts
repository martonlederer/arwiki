import { Component, OnInit } from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import { UserSettingsService } from './auth/user-settings.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
	opened: boolean = false;
  menuPosition: any = 'start';

  constructor(
    private _translate: TranslateService,
    private _userSettings: UserSettingsService
  ) {
    // this language will be used as a fallback when a translation isn't found in the current language
    // _translate.setDefaultLang('en');
    // the lang to use, if the lang isn't available, it will use the current loader to get them
    //_translate.use('en');
    const defLang = this._userSettings.getDefaultLang();
    if (defLang.writing_system == 'RTL') {
      this.menuPosition = 'end';
    } else {
      this.menuPosition = 'start';
    }

    this._userSettings.langObservable$.subscribe((lang: any) => {
      if (lang.writing_system == 'RTL') {
        this.menuPosition = 'end';
      } else {
        this.menuPosition = 'start';
      }
    })

    
  }

  ngOnInit() {
    this.consoleWelcomeMessage();
  }

  consoleWelcomeMessage() {
    console.log('%cWelcome to the arwiki!', 'background: #000; color: #FFF; font-size: 32px; padding: 10px;');
    console.log('%cPlease let us know if you find some interesting bug 😄', 'font-weight: bold;');
  }


    
}
