import { Component, OnInit, OnDestroy } from '@angular/core';
import { ArwikiQuery } from '../../core/arwiki-query';
import { ArweaveService } from '../../core/arweave.service';
import { Subscription, of, Observable } from 'rxjs';
import { ArwikiTokenContract } from '../../core/arwiki-contracts/arwiki-token.service';
import { UtilsService } from '../../core/utils.service';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { switchMap } from 'rxjs/operators';
import { ArwikiPage } from '../../core/interfaces/arwiki-page';
import { ArwikiPageIndex } from '../../core/interfaces/arwiki-page-index';
import { UserSettingsService } from '../../core/user-settings.service';
import ArdbBlock from 'ardb/lib/models/block';
import ArdbTransaction from 'ardb/lib/models/transaction';
import {PageEvent} from '@angular/material/paginator';

@Component({
  templateUrl: './view-detail.component.html',
  styleUrls: ['./view-detail.component.scss']
})
export class ViewDetailComponent implements OnInit {
  arwikiQuery!: ArwikiQuery;
  pagesSubscription: Subscription = Subscription.EMPTY;
  loadingPages: boolean = false;
  category: string = '';
  pages: ArwikiPage[] = [];
  routeLang: string = '';
  baseURL: string = this._arweave.baseURL;
  defaultTheme: string = '';
  errorLoadingCategory: boolean = false;
  paginatorLength = 0;
  paginatorPageSize = 4;
  paginatorPageIndex = 0;
  paginatorPageSizeOptions = [4, 12, 24];

  constructor(
  	private _arweave: ArweaveService,
  	private _arwikiTokenContract: ArwikiTokenContract,
  	private _utils: UtilsService,
  	private _route: ActivatedRoute,
    private _location: Location,
    private _userSettings: UserSettingsService
 	) { }

  async ngOnInit() {
    // Init ardb instance
    this.arwikiQuery = new ArwikiQuery(this._arweave.arweave);
  	this.category = this._route.snapshot.paramMap.get('category')!;
    this.routeLang = this._route.snapshot.paramMap.get('lang')!;

    this.getDefaultTheme();

    this._route.paramMap.subscribe(async params => {
      this.routeLang = params.get('lang')!;
      this.category = params.get('category')!;
      await this._loadContent();
    });
    
    

  }

  private async _loadContent() {
    this.loadingPages = true;
    let networkInfo;
    let maxHeight = 0;
    this.paginatorPageIndex = 0;
    try {
      networkInfo = await this._arweave.arweave.network.getInfo();
      maxHeight = networkInfo.height;
    } catch (error) {
      this._utils.message(`${error}`, 'error');
      return;
    }
    this.pagesSubscription = this.getPagesByCategory(
      this.category,
      this.routeLang,
      maxHeight
    ).subscribe({
      next: async (finalRes: ArwikiPage[]) => {
        this.pages = finalRes;
        this.loadingPages = false;
        this.paginatorLength = this.pages ? this.pages.length : 0;
      },
      error: (error: string) => {
        this._utils.message(error, 'error');
        this.loadingPages = false;
        this.errorLoadingCategory = true;
      }
    });
  }

  slugToLabel(_s: string) {
  	return _s.replace(/_/gi, " ");
  }

  ngOnDestroy() {
  	if (this.pagesSubscription) {
  		this.pagesSubscription.unsubscribe();
  	}

  }

  sanitizeMarkdown(_s: string) {
    _s = _s.replace(/[#*=\[\]]/gi, '')
    let res: string = `${_s.substring(0, 250)} ...`;
    return res;
  }

  
  sanitizeImg(_img: string) {
    let res: string = _img.indexOf('http') >= 0 ?
      _img :
      _img ? `${this.baseURL}${_img}` : '';
    return res;
  }


  goBack() {
    this._location.back();
  }

  /*
  * @dev
  */
  getPagesByCategory(
    _category: string,
    _langCode: string,
    _maxHeight: number,
    _limit: number = 100
  ): Observable<ArwikiPage[]> {
    let adminList: string[] = [];
    let verifiedPages: string[] = [];
    let allApprovedPages: ArwikiPageIndex = {};
    return this._arwikiTokenContract.getAdminList()
      .pipe(
        switchMap((_adminList: string[]) => {
          adminList = _adminList;
          return this._arwikiTokenContract.getCategories();
        }),
        switchMap((categoriesContractState) => {
          // Validate category 
          if (!(_category in categoriesContractState)) {
            throw new Error('Invalid category!');
          }
          return this._arwikiTokenContract.getApprovedPages(
            _langCode,
            -1,
            true
          );
        }),
        switchMap((_approvedPages: ArwikiPageIndex) => {
          allApprovedPages = _approvedPages;
          verifiedPages = Object.keys(_approvedPages)
            .filter((slug) => {
              return _approvedPages[slug].category === _category;
            }).map((slug) => {
              return _approvedPages[slug].content!;
            })
          return this.arwikiQuery.getTXsData(verifiedPages);
        }),
        switchMap((_pages: ArdbTransaction[]|ArdbBlock[]) => {
          const finalRes: ArwikiPage[] = [];
          for (let p of _pages) {
            const pTX: ArdbTransaction = new ArdbTransaction(p, this._arweave.arweave);
            const title = this.arwikiQuery.searchKeyNameInTags(pTX.tags, 'Arwiki-Page-Title');
            const slug = this.arwikiQuery.searchKeyNameInTags(pTX.tags, 'Arwiki-Page-Slug');
            const category = this.arwikiQuery.searchKeyNameInTags(pTX.tags, 'Arwiki-Page-Category');
            const img = this.arwikiQuery.searchKeyNameInTags(pTX.tags, 'Arwiki-Page-Img');
            const lang = this.arwikiQuery.searchKeyNameInTags(pTX.tags, 'Arwiki-Page-Lang');
            const owner = pTX.owner.address;
            const id = pTX.id;
            const sponsor = allApprovedPages[slug].sponsor;

            finalRes.push({
              title: title,
              slug: slug,
              category: category,
              img: img,
              owner: owner,
              id: id,
              language: lang,
              sponsor: sponsor
            });
            
          }
          return of(finalRes);
        }),



      );
  }


  getDefaultTheme() {
    this.defaultTheme = this._userSettings.getDefaultTheme();
    this._userSettings.defaultThemeStream.subscribe(
      (theme) => {
        this.defaultTheme = theme;
      }
    );
  }

  validateObj(_obj: object) {
    return !!Object.keys(_obj).length;
  }

  paginatorEvent(e: PageEvent) {
    this.paginatorPageSize = e.pageSize;
    this.paginatorPageIndex = e.pageIndex;
  }

  paginatedResults(): ArwikiPage[] {
    const start = this.paginatorPageIndex * this.paginatorPageSize ;
    const end = this.paginatorPageIndex * this.paginatorPageSize + this.paginatorPageSize;
    const res = this.pages.slice(start, end);
    return res;
  }


 
}
