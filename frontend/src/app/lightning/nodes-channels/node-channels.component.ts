import { formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, NgZone, OnChanges, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ECharts, EChartsOption, TreemapSeriesOption } from 'echarts';
import { Observable, tap } from 'rxjs';
import { lerpColor } from 'src/app/shared/graphs.utils';
import { AmountShortenerPipe } from 'src/app/shared/pipes/amount-shortener.pipe';
import { LightningApiService } from '../lightning-api.service';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-node-channels',
  templateUrl: './node-channels.component.html',
  styleUrls: ['./node-channels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeChannels implements OnChanges {
  @Input() publicKey: string;

  chartInstance: ECharts;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  channelsObservable$: Observable<any>;
  isLoading: true;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private lightningApiService: LightningApiService,
    private amountShortenerPipe: AmountShortenerPipe,
    private zone: NgZone,
    private router: Router,
    private stateService: StateService,
  ) {}

  ngOnChanges(): void {
    this.prepareChartOptions(null);

    this.channelsObservable$ = this.lightningApiService.getChannelsByNodeId$(this.publicKey, -1, 'active')
      .pipe(
        tap((response) => {
          const biggestCapacity = response.body[0].capacity;
          this.prepareChartOptions(response.body.map(channel => {
            return {
              name: channel.node.alias,
              value: channel.capacity,
              shortId: channel.short_id,
              id: channel.id,
              itemStyle: {
                color: lerpColor('#1E88E5', '#D81B60', Math.pow(channel.capacity / biggestCapacity, 0.4)),
              }
            };
          }));
        })
      );
  }

  prepareChartOptions(data): void {
    this.chartOptions = {
      tooltip: {
        trigger: 'item',
        textStyle: {
          align: 'left',
        }
      },
      series: <TreemapSeriesOption[]>[
        {
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          roam: false,
          type: 'treemap',
          data: data,
          nodeClick: 'link',
          progressive: 100,
          tooltip: {
            show: true,
            backgroundColor: 'rgba(17, 19, 31, 1)',
            borderRadius: 4,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            textStyle: {
              color: '#b1b1b1',
            },
            borderColor: '#000',
            formatter: (value): string => {
              if (value.data.name === undefined) {
                return ``;
              }
              let capacity = '';
              if (value.data.value > 100000000) {
                capacity = formatNumber(Math.round(value.data.value / 100000000), this.locale, '1.2-2') + ' BTC';
              } else {
                capacity = <string>this.amountShortenerPipe.transform(value.data.value, 2) + ' sats';
              }

              return `
                <b style="color: white; margin-left: 2px">${value.data.shortId}</b><br>
                <span>Node: ${value.name}</span><br>
                <span>Capacity: ${capacity}</span>
              `;
            }
          },
          itemStyle: {
            borderColor: 'black',
            borderWidth: 1,
          },
          breadcrumb: {
            show: false,
          }
        }
      ]
    };    
  }

  onChartInit(ec: ECharts): void {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      //@ts-ignore
      if (!e.data.id) {
        return;
      }
      this.zone.run(() => {
        //@ts-ignore
        const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/channel/${e.data.id}`);
        this.router.navigate([url]);
      });
    });
  }
}