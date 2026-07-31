import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { Chart } from 'chart.js/auto';
import { Capacitor } from '@capacitor/core';
import { File } from '@awesome-cordova-plugins/file/ngx';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';
import { ScoreDbService } from '../services/score-db.service';
import { Score, Message, CapabilityScore } from '../data/score';

type Graph = {
  date: Date,
  label: string,
  score: number,
  message: string,
  subGraph: { [key: string]: Graph }
};

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {

  @ViewChild('lineCanvas1', {read: ElementRef, static: false}) lineCanvas1: ElementRef;
  @ViewChild('lineCanvas2', {read: ElementRef, static: false}) lineCanvas2: ElementRef;
  @ViewChild('lineCanvas3', {read: ElementRef, static: false}) lineCanvas3: ElementRef;
  @ViewChild('lineCanvas4', {read: ElementRef, static: false}) lineCanvas4: ElementRef;
  @ViewChild('lineCanvas5', {read: ElementRef, static: false}) lineCanvas5: ElementRef;
  @ViewChild('lineCanvas3_2', {read: ElementRef, static: false}) lineCanvas3_2: ElementRef;
  @ViewChild('lineCanvas4_2', {read: ElementRef, static: false}) lineCanvas4_2: ElementRef;
  @ViewChild('lineCanvas5_2', {read: ElementRef, static: false}) lineCanvas5_2: ElementRef;

  static GRAPH_MAX: number = 30;

  selectCapabilityTab: boolean = false;

  capabilityScoreTargetDays: number = 0;

  scoreShowStarArea1: boolean = true;
  scoreShowStarArea2: boolean = true;
  scoreShowStarArea3: boolean = true;

  scoreA: number = 0;
  scoreAMessage: string = "運転診断結果がありません。";
  scoreB: number = 0;
  scoreBMessage: string = "運転診断結果がありません。";
  scoreC: number = 0;
  scoreCMessage: string = "運転診断結果がありません。";

  rankScoreA: string = ' - ';
  rankScoreB: string = ' - ';
  rankScoreC: string = ' - ';

  private chart: Chart;

  private chart1: (Chart | null);
  private chart2: (Chart | null);
  private chart3: (Chart | null);
  private chart4: (Chart | null);
  private chart5: (Chart | null);
  private chart3_2: (Chart | null);
  private chart4_2: (Chart | null);
  private chart5_2: (Chart | null);

  private label1: string;
  private label2: string;
  private label3: string;
  private label4: string;
  public labelA: string;
  public labelB: string;
  public labelC: string;

  comment11: string = '運転診断結果がありません。';
  comment12: string = '';
  comment21: string = '運転診断結果がありません。';
  comment22: string = '';

  selectLineCanvasId: string = '';

  subGraphDateText: string = '';
  subGraphDateFullText: string = '';

  // コンストラクタ
  constructor(
    private screenOrientation: ScreenOrientation,
    private loginService: LoginService,
    private logService: LogService,
    private scoreDbService: ScoreDbService,
    private file: File) {
  }

  // コンポーネントの初期化時に実行される
  ngOnInit() {
  }

  // ページがアクティブになる直前に実行される
  ionViewWillEnter() {
    if (Capacitor.getPlatform() == 'android') {
      this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.PORTRAIT);
    }

    this.selectCapabilityTab = false;

    var self = this;
    this.scoreDbService.selectAllScore()
    .then(async (scoreList: Array<Score>)=>{

      await this.initialize();

      if (scoreList.length == 0)
        return;

      try {
        self.initializeHistoryCanvas(scoreList);
      } catch (error: any) {
        self.logService.error('[DrivingScore][HistoryPage] initializeHistoryCanvas', error);
      }

      try {
        self.initializeCapabilityScoreCanvas(scoreList);
      } catch (error: any) {
        self.logService.error('[DrivingScore][HistoryPage] initializeCapabilityScoreCanvas', error);
      }
    })
    .catch((error: any) => {
      self.logService.error('[DrivingScore][HistoryPage] ionViewWillEnter: error='+error.message);
    });

  }

  async initialize() {
    await this.loginService.initialize();
    await this.logService.initialize(this.file);

    this.label1 = this.loginService.settings.label.label1;
    this.label2 = this.loginService.settings.label.label2;
    this.label3 = this.loginService.settings.label.label3;
    this.label4 = this.loginService.settings.label.label4;
    this.labelA = this.loginService.settings.label.labelA;
    this.labelB = this.loginService.settings.label.labelB;
    this.labelC = this.loginService.settings.label.labelC;

    this.scoreShowStarArea1 = this.loginService.settings.scoreShowStar.area1;
    this.scoreShowStarArea2 = this.loginService.settings.scoreShowStar.area2;
    this.scoreShowStarArea3 = this.loginService.settings.scoreShowStar.area3;

    //過去N日
    this.capabilityScoreTargetDays = this.loginService.settings.capabilityScoreTargetDays;
  }

  /**
   * 運転診断結果のグラフを描画する
   */
  initializeHistoryCanvas(scoreList: Array<Score>) {
    // 総合（over_all）のコメントは、一番最後に出現した "message" を表示する
    // SELECTで取得したレコードは新しい順になっているので、一番初めに出現するレコードが対象
    const labels = Array();
    const tooltip = Array();

    const overAllList = Array();
    const score1List = Array();
    const score2List = Array();
    const score3List = Array();
    const score4List = Array();

    const count1: any = [];
    count1['positive'] = {};
    count1['negative'] = {};

    const count2: any = [];
    count2['positive'] = {};
    count2['negative'] = {};

    const message: any = {};
    const keys: any = {};
    for (let i=0; i<scoreList.length; i++) {
      const score = scoreList[i];
      const scoreId = score.timestamp;
      labels.unshift(this.dateFormat(new Date(score.timestamp), false, false));
      overAllList.unshift(this.scoreShowStarArea1 ? score.overAll : this.getRank(score.overAll));
      score1List.unshift(this.scoreShowStarArea2 ? score.score1 : this.getRank(score.score1));
      score2List.unshift(this.scoreShowStarArea2 ? score.score2 : this.getRank(score.score2));
      score3List.unshift(this.scoreShowStarArea2 ? score.score3 : this.getRank(score.score3));
      score4List.unshift(this.scoreShowStarArea2 ? score.score4 : this.getRank(score.score4));

      let tooltipCount: any = {};
      tooltipCount['positive'] = {over_all:0, score1:0, score2:0, score3:0, score4:0};
      tooltipCount['negative'] = {over_all:0, score1:0, score2:0, score3:0, score4:0};

      for (let i=0; i<score.messages.length; i++) {
        const id = score.messages[i].id;
        const key = score.messages[i].key;
        const type = score.messages[i].type;

        if (tooltipCount[type] === undefined || tooltipCount[type][key] === undefined) {
          continue;
        }
        tooltipCount[type][key]++;

        if ((this.label1 === '' && key === 'score1')
          ||(this.label2 === '' && key === 'score2')
          ||(this.label3 === '' && key === 'score3')
          ||(this.label4 === '' && key === 'score4')) {
          continue;
        }

        // 過去の診断結果は交差点名不要
        message[id] = score.messages[i].text.replace(/%INTERSECTION/g, '');

        keys[id] = key;

        if (key == 'over_all') {
          if (count1[type][id] == null)
            count1[type][id] = 0;

          count1[type][id]++;

        } else {
          if (count2[type][id] == null)
            count2[type][id] = 0;

          count2[type][id]++;
        }
      }

      tooltip.unshift(tooltipCount);

      if (labels.length >= HistoryPage.GRAPH_MAX) {
        break;
      }
    }

    const positive = this.loginService.settings.orderOfMessage == 0 ? 'positive' : 'negative';
    const negative = this.loginService.settings.orderOfMessage == 0 ? 'negative' : 'positive';

    this.comment11 = this.getMessage(count1[positive], message, keys, true);
    this.comment12 = this.getMessage(count1[negative], message, keys, true);
    if (this.comment11 == '') {
      this.comment11 = this.comment12;
      this.comment12 = '';
    }

    this.comment21 = this.getMessage(count2[positive], message, keys, false);
    this.comment22 = this.getMessage(count2[negative], message, keys, false);
    if (this.comment21 == '') {
      this.comment21 = this.comment22;
      this.comment22 = '';
    }

    this.logService.debug('[DrivingScore][HistoryPage] 運転診断履歴の確認用ログ ここから');
    for (let i=0; i<labels.length; i++) {
      this.logService.debug('[DrivingScore][HistoryPage] score date='+labels[i]+', over_all='+overAllList[i]+', score1='+score1List[i]+', score2='+score2List[i]+', score3='+score3List[i]+', score4='+score4List[i]);
    }
    this.logService.debug('[DrivingScore][HistoryPage] message over_all='+this.joinMessage(this.comment11, this.comment12));
    this.logService.debug('[DrivingScore][HistoryPage] message other='+this.joinMessage(this.comment21, this.comment22));
    this.logService.debug('[DrivingScore][HistoryPage] 運転診断履歴の確認用ログ ここまで');

    try {
      this.lineChart1(labels, tooltip, overAllList);
    } catch (error: any) {
      this.logService.error('[DrivingScore][HistoryPage] lineChart1', error);
    }
    try {
      this.lineChart2(labels, tooltip, score1List, score2List, score3List, score4List);
    } catch (error: any) {
      this.logService.error('[DrivingScore][HistoryPage] lineChart2', error);
    }
  }

  pushCapabilityGraphData(
    graph: {[key: string]: Graph},
    timestamp: number,
    capabilityTimestamp: number,
    score: number,
    message: string,
    ) {

    if (score <= -1 || HistoryPage.GRAPH_MAX <= Object.keys(graph).length)
      return;

    message = message ?? "";

    const scoreDate = new Date(timestamp);
    const label = this.dateFormat(scoreDate, false, false);

    const capabilityDate = new Date(capabilityTimestamp);
    const capabilityLabel = this.dateFormat(capabilityDate, false, false);

    if (graph[timestamp] === undefined) {
      graph[timestamp] = {date: scoreDate, label: label, score: score, message: message, subGraph: {}};
    }

    if (HistoryPage.GRAPH_MAX <= Object.keys(graph[timestamp].subGraph).length)
      return;
    graph[timestamp].subGraph[capabilityTimestamp] = {date: capabilityDate, label: capabilityLabel, score: score, message: message, subGraph: {}};
  }

  makeCapabilityGraphData(
    graph: {[key: string]: Graph},
    targetDate: Date,
    dummyData: boolean,
    ): {keys: Array<string>, labels: Array<string>, data: Array<number>, messages: Array<string>, firstMessage: string, totalScore: number} {
    const keys = Array();
    const labels = Array();
    const data = Array();
    const messages = Array();
    let firstMessage: string = "";
    let totalScore = 0;
    let totalScoreCount = 0;

    const sortedKeys = Object.keys(graph).sort((a, b) => b.localeCompare(a));
    for (const key of sortedKeys) {
      if (labels.length < HistoryPage.GRAPH_MAX) {
        keys.unshift(key);
        labels.unshift(graph[key].label);
        data.unshift(this.scoreShowStarArea3 ? graph[key].score : this.getRank(graph[key].score));
        messages.unshift(graph[key].message);
      }

      if (firstMessage === "") {
        firstMessage = graph[key].message;
      }

      if (targetDate <= graph[key].date) {
        totalScore += graph[key].score;
        totalScoreCount++;
      }
    }
    totalScore = this.round((totalScore * 1.0) / totalScoreCount);

    // ラベルのダミー
    if (dummyData) {
      for (let i=labels.length; i<HistoryPage.GRAPH_MAX; i++) {
        labels.push('');
      }
    }

    return {
      keys: keys,
      labels: labels,
      data: data,
      messages: messages,
      firstMessage: firstMessage,
      totalScore: totalScore
    };
  }


  /**
   * 能力指標のグラフを描画
   */
  initializeCapabilityScoreCanvas(scoreList: Array<Score>) {
    this.scoreA = 0;
    this.scoreAMessage = "";
    this.scoreB = 0;
    this.scoreBMessage = "";
    this.scoreC = 0;
    this.scoreCMessage = "";

    this.rankScoreA = " - ";
    this.rankScoreB = " - ";
    this.rankScoreC = " - ";

    const graph3: {[key: string]: Graph} = {}; //筋力
    const graph4: {[key: string]: Graph} = {}; //柔軟性
    const graph5: {[key: string]: Graph} = {}; //視野の広さ
    for (const score of scoreList) {
      for (const capabilityScore of score.graphCapabilityScoreList) {
        if (capabilityScore.initialize === false) {
          continue;
        }

        if (this.scoreAMessage === "")
          this.scoreAMessage = capabilityScore.scoreAMessage;
        if (this.scoreBMessage === "")
          this.scoreBMessage = capabilityScore.scoreBMessage;
        if (this.scoreCMessage === "")
          this.scoreCMessage = capabilityScore.scoreCMessage;

        this.pushCapabilityGraphData(graph3, score.timestamp, capabilityScore.timestamp, capabilityScore.scoreA, capabilityScore.scoreAMessage);
        this.pushCapabilityGraphData(graph4, score.timestamp, capabilityScore.timestamp, capabilityScore.scoreB, capabilityScore.scoreBMessage);
        this.pushCapabilityGraphData(graph5, score.timestamp, capabilityScore.timestamp, capabilityScore.scoreC, capabilityScore.scoreCMessage);
      }
    }

    // グラフを描画
    if (this.lineCanvas3 !== undefined) {
      this.lineChartCapability(this.labelA, 'rgba(0, 141, 183, 1)', graph3, true, this.lineCanvas3.nativeElement)
    }
    if (this.lineCanvas4 !== undefined) {
      this.lineChartCapability(this.labelB, 'rgba(58, 180, 131, 1)', graph4, true, this.lineCanvas4.nativeElement)
    }
    if (this.lineCanvas5 !== undefined) {
      this.lineChartCapability(this.labelC, 'rgba(237, 108, 0, 1)', graph5, true, this.lineCanvas5.nativeElement)
    }
  }

  /**
   * タブ：ヒストリーをクリック
   */
  onHistoryClick() {
    this.selectCapabilityTab = false;
    this.selectLineCanvasId = '';
  }

  /**
   * タブ：能力指標をクリック
   */
  onCapabilityClick() {
    this.selectCapabilityTab = true;
    this.selectLineCanvasId = '';
  }

  onMouseOver() {
    this.selectLineCanvasId = '';
  }

  joinMessage(msg1: string, msg2: string): string {
    if (msg1 != '' && msg2 != '') {
      return msg1 + "\n" + msg2;
    } else if (msg1 != '') {
      return msg1;
    } else if (msg2 != '') {
      return msg2;
    }
    return '';
  }

  lineChart1(labels: any,  tooltip: any, overAll: any) {
    for (let i=overAll.length; i<HistoryPage.GRAPH_MAX; i++) {
      overAll.push(0);
    }

    for (let i=labels.length; i<HistoryPage.GRAPH_MAX; i++) {
      labels.push('');
    }

    this.chartDestroy(this.lineCanvas1.nativeElement);

    //Chart.register(LineController, LineElement, PointElement, LinearScale, Title);
    var self = this;
    const chart = new Chart(this.lineCanvas1.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '総合スコア',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderColor: 'rgba(235, 97, 59, 1)',
            pointRadius: 2,
            fill: false,
            borderWidth: 2,
            data: overAll,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (tooltip[Number(context.parsed.x)] == null) {
                  label += ': - ';
                } else {
                  label = ' ' + Math.round((context.parsed.y ?? 0) * 100) / 100;
                  label += self.scoreShowStarArea1 ? '点' : '位';
                }
                return label;
              }
            },
            mode: 'index',
            intersect: false,
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            ticks: {
              font: {
                size: 8,
              }
            },
          },
          y: {
            min: (self.scoreShowStarArea1 ? 0 : 1),
            max: 100,
            ticks: {
              stepSize: 10
            },
            position: 'left',
            reverse: !self.scoreShowStarArea1
          },
        },
      },
    });
    this.setChartInstance(chart, this.lineCanvas1.nativeElement);
  }

  lineChart2(labels: any,  tooltip: any, score1List: any, score2List: any, score3List: any, score4List: any) {
    for (let i=score1List.length; i<HistoryPage.GRAPH_MAX; i++) {
      score1List.push(0);
      score2List.push(0);
      score3List.push(0);
      score4List.push(0);
    }

    for (let i=labels.length; i<HistoryPage.GRAPH_MAX; i++) {
      labels.push('');
    }

    this.chartDestroy(this.lineCanvas2.nativeElement);

    var self = this;
    //Chart.register(LineController, LineElement, PointElement, LinearScale, Title);
    const chart = new Chart(this.lineCanvas2.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = '';
                if (tooltip[Number(context.parsed.x)] == null) {
                  label = context.dataset.label || '';
                  label += ': - ';
                } else {
                  label = ' ' + (context.parsed.y ?? 0).toFixed(0);
                  label += self.scoreShowStarArea2 ? '点' : '位';
                  label += ', ポジティブ ';

                  if (context.dataset.label == self.label1) {
                    label += tooltip[Number(context.parsed.x)]['positive']['score1'] + '回';
                  } else if (context.dataset.label == self.label2) {
                    label += tooltip[Number(context.parsed.x)]['positive']['score2'] + '回';
                  } else if (context.dataset.label == self.label3) {
                    label += tooltip[Number(context.parsed.x)]['positive']['score3'] + '回';
                  } else if (context.dataset.label == self.label4) {
                    label += tooltip[Number(context.parsed.x)]['positive']['score4'] + '回';
                  }

                  label += ', ネガティブ ';
                  if (context.dataset.label == self.label1) {
                    label += tooltip[Number(context.parsed.x)]['negative']['score1'] + '回';
                  } else if (context.dataset.label == self.label2) {
                    label += tooltip[Number(context.parsed.x)]['negative']['score2'] + '回';
                  } else if (context.dataset.label == self.label3) {
                    label += tooltip[Number(context.parsed.x)]['negative']['score3'] + '回';
                  } else if (context.dataset.label == self.label4) {
                    label += tooltip[Number(context.parsed.x)]['negative']['score4'] + '回';
                  }
                }
                return label;
              }
            },
            mode: 'index',
            intersect: false,
          },
          legend: {
            display: true,
            position: 'bottom',
            align: 'start',
            labels: {
              boxWidth: 13,
              font: {
                size: 14
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: {
                size: 8,
              }
            },
          },
          y: {
            min: (self.scoreShowStarArea2 ? 0 : 1),
            max: 100,
            ticks: {
              stepSize: 10
            },
            position: 'left',
            reverse: !self.scoreShowStarArea2
          },
        },
      },
    });

    if (this.label1 !== '') {
      chart.data.datasets.push({
        label: this.label1,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(0, 141, 183, 1)',
        pointRadius: 1,
        fill: false,
        borderWidth: 1,
        data: score1List,
      });
    }
    if (this.label2 !== '') {
      chart.data.datasets.push({
        label: this.label2,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(58, 180, 131, 1)',
        pointRadius: 1,
        fill: false,
        borderWidth: 1,
        data: score2List,
      });
    }
    if (this.label3 !== '') {
      chart.data.datasets.push({
        label: this.label3,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(237, 108, 0, 1)',
        pointRadius: 1,
        fill: false,
        borderWidth: 1,
        data: score3List,
      });
    }
    if (this.label4 !== '') {
      chart.data.datasets.push({
        label: this.label4,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(253, 210, 62, 1)',
        pointRadius: 1,
        fill: false,
        borderWidth: 1,
        data: score4List,
      });
    }
    chart.update();
    this.setChartInstance(chart, this.lineCanvas2.nativeElement);
  }

  lineChartCapability(
    label: string,
    borderColor: string,
    graph: {[key: string]: Graph},
    dummyData: boolean,
    element: HTMLCanvasElement) {

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - this.capabilityScoreTargetDays);

    const graphData = this.makeCapabilityGraphData(graph, targetDate, dummyData);
    var keys = graphData.keys;
    var labels = graphData.labels;
    var messages = graphData.messages;

    if (graphData.totalScore !== undefined && graphData.totalScore !== null && !isNaN(graphData.totalScore)) {
      switch(element.id) {
        case "lineCanvas3":
          this.scoreA = graphData.totalScore;
          this.rankScoreA = this.getRank(this.scoreA).toString();
          break;
        case "lineCanvas4":
          this.scoreB = graphData.totalScore;
          this.rankScoreB = this.getRank(this.scoreB).toString();
          break;
        case "lineCanvas5":
          this.scoreC = graphData.totalScore;
          this.rankScoreC = this.getRank(this.scoreC).toString();
          break;
      }
    }

    this.chartDestroy(element);

    this.selectLineCanvasId = element.id;

    var self = this;
    //Chart.register(LineController, LineElement, PointElement, LinearScale, Title);
    const chart = new Chart(element, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderColor: borderColor,
            pointRadius: 1,
            fill: false,
            borderWidth: 1,
            data: graphData.data,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let pointLabel = context.dataset.label || '';
                if (pointLabel == '') return '';

                pointLabel = ' '+Math.round(context.parsed.y ?? 0);
                pointLabel += self.scoreShowStarArea3 ? '点' : '位';

                let lineCanvas;
                const index = Number(context.parsed.x);
                if (context.dataset.label == self.labelA) {
                  self.scoreAMessage = messages[index] ?? "";
                  lineCanvas = self.lineCanvas3_2.nativeElement;

                } else if (context.dataset.label == self.labelB) {
                  self.scoreBMessage = messages[index] ?? "";
                  lineCanvas = self.lineCanvas4_2.nativeElement;

                } else if (context.dataset.label == self.labelC) {
                  self.scoreCMessage = messages[index] ?? "";
                  lineCanvas = self.lineCanvas5_2.nativeElement;
                }

                const key = keys[index];
                const subGraphLength = Object.keys(graph[key].subGraph).length;
                if (1 < subGraphLength) {
                  const newDateFullText = self.dateFormat(graph[key].date, true, true);
                  const oldText = self.subGraphDateFullText + ':' + self.selectLineCanvasId;
                  const newText = newDateFullText + ' : ' + lineCanvas.id;

                  if (oldText === newText) {
                    self.chartRender(lineCanvas);
                  } else {
                    self.subGraphDateText = self.dateFormat(graph[key].date, true, false);
                    self.subGraphDateFullText = newDateFullText;
                    self.lineChartCapability(label, borderColor, graph[key].subGraph, false, lineCanvas)
                  }
                } else if (1 === subGraphLength) {
                  self.subGraphDateFullText = '';
                  self.selectLineCanvasId = '';
                }

                return pointLabel;
              }
            },
            mode: 'index',
            intersect: false,
          },
          legend: { display: false, position: 'bottom', align: 'start', labels: { boxWidth: 13, font: { size: 14 } } }
        },
        scales: {
          x: { ticks: { font: { size: 8 } }, },
          y: {
            min: (self.scoreShowStarArea3 ? 0 : 1),
            max: 100,
            ticks: { stepSize: 10 },
            position: 'left',
            reverse: !self.scoreShowStarArea3
          }
        },
      },
    });
    this.setChartInstance(chart, element);
  }

  dateFormat(date: Date, isYY: boolean, isSS: boolean) {
    const YY = String(date.getFullYear());
    const MM = (date.getMonth()+1) < 10 ? '0'+(date.getMonth()+1) : String(date.getMonth()+1);
    const DD = date.getDate() < 10 ? '0'+date.getDate() : String(date.getDate());
    const hh = date.getHours() < 10 ? '0'+date.getHours() : String(date.getHours());
    const mm = date.getMinutes() < 10 ? '0'+date.getMinutes() : String(date.getMinutes());
    const ss = date.getSeconds() < 10 ? '0'+date.getSeconds() : String(date.getSeconds());
    if (isYY && isSS) {
      return YY+'/'+MM+'/'+DD+' '+hh+':'+mm+':'+ss;
    } else if (isYY) {
      return YY+'/'+MM+'/'+DD+' '+hh+':'+mm;
    } else if (isSS) {
      return MM+'/'+DD+' '+hh+':'+mm+':'+ss;
    } else {
      return MM+'/'+DD+' '+hh+':'+mm;
    }
  }

  getMessage(data: any, message: any, keys: any, first: boolean): string {
    let max = 0;
    let maxKey = '';
    for (let key in data) {
      if (max < Number(data[key])) {
        max = Number(data[key]);
        maxKey = key;
        if (first)
          break;
      }
    }
    if (maxKey == '') {
      return '';
    }

    let keyLabel = '';
    switch (keys[maxKey]) {
      case 'score1':
        keyLabel = '(' + this.label1 + ')\n';
        break;
      case 'score2':
        keyLabel = '(' + this.label2 + ')\n';
        break;
      case 'score3':
        keyLabel = '(' + this.label3 + ')\n';
        break;
      case 'score4':
        keyLabel = '(' + this.label4 + ')\n';
        break;
    }
    return keyLabel + message[maxKey].replace(/%COUNT/g, String(max));
  }

  round(value: number): number {
    return Math.round(value * 100) / 100.0;
  }

  sleep(ms: number): Promise<any>  {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setChartInstance(chart: Chart, element: HTMLCanvasElement) {
    try {
      switch(element.id) {
        case "lineCanvas1": this.chart1 = chart; break;
        case "lineCanvas2": this.chart2 = chart; break;
        case "lineCanvas3": this.chart3 = chart; break;
        case "lineCanvas4": this.chart4 = chart; break;
        case "lineCanvas5": this.chart5 = chart; break;
        case "lineCanvas3_2": this.chart3_2 = chart; break;
        case "lineCanvas4_2": this.chart4_2 = chart; break;
        case "lineCanvas5_2": this.chart5_2 = chart; break;
      }
      this.chartRender(element);
    } catch(error) {
      this.logService.error('[DrivingScore][HistoryPage] setChartInstance', error);
    }
  }

  chartDestroy(element: HTMLCanvasElement) {
    try {
      switch(element.id) {
        case "lineCanvas1": if (this.chart1) { this.chart1.destroy(); this.chart1 = null; } break;
        case "lineCanvas2": if (this.chart2) { this.chart2.destroy(); this.chart2 = null; } break;
        case "lineCanvas3": if (this.chart3) { this.chart3.destroy(); this.chart3 = null; } break;
        case "lineCanvas4": if (this.chart4) { this.chart4.destroy(); this.chart4 = null; } break;
        case "lineCanvas5": if (this.chart5) { this.chart5.destroy(); this.chart5 = null; } break;
        case "lineCanvas3_2": if (this.chart3_2) { this.chart3_2.destroy(); this.chart3_2 = null; } break;
        case "lineCanvas4_2": if (this.chart4_2) { this.chart4_2.destroy(); this.chart4_2 = null; } break;
        case "lineCanvas5_2": if (this.chart5_2) { this.chart5_2.destroy(); this.chart5_2 = null; } break;
      }
    } catch(error) {
      this.logService.error('[DrivingScore][HistoryPage] chartDestroy', error);
    }
  }

  chartRender(element: HTMLCanvasElement): Promise<any> {
    return new Promise(async (resolve, reject) => {
      await this.sleep(100);
      try {
        switch(element.id) {
          case "lineCanvas1": if (this.chart1) { this.chart1.render(); } break;
          case "lineCanvas2": if (this.chart2) { this.chart2.render(); } break;
          case "lineCanvas3": if (this.chart3) { this.chart3.render(); } break;
          case "lineCanvas4": if (this.chart4) { this.chart4.render(); } break;
          case "lineCanvas5": if (this.chart5) { this.chart5.render(); } break;
          case "lineCanvas3_2": if (this.chart3_2) { this.chart3_2.render(); } break;
          case "lineCanvas4_2": if (this.chart4_2) { this.chart4_2.render(); } break;
          case "lineCanvas5_2": if (this.chart5_2) { this.chart5_2.render(); } break;
        }
        resolve("");
      } catch(error) {
        this.logService.error('[DrivingScore][HistoryPage] chartRender', error);
        reject(error);
      }
    });
  }

  getRank(score: number): number {
    const rank = 101 - Math.round(score);
    return 100 < rank ? 100 : rank;
  }
}
