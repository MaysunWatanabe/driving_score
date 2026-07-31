import { environment } from '../../environments/environment';

export class Message {
    public initialize: boolean = false;
    public timestamp: number;
    public intersection: string;
    public id: number;
    public key: string;
    public type: string;
    public text: string;
    public score: number = 0;

    constructor(data: any, score: Score) {
      if (data == null
          || data.id == null
          || data.message == null) {
        return;
      }

      this.initialize = true;
      this.timestamp = score.timestamp;
      this.intersection = score.intersection;
      this.id = data.id;
      this.key = data.key ?? '';
      this.type = data.type ?? '';
      this.text = data.message;

      switch (data.key) {
        case 'over_all': this.score = score.overAll; break;
        case 'score1': this.score = score.score1; break;
        case 'score2': this.score = score.score2; break;
        case 'score3': this.score = score.score3; break;
        case 'score4': this.score = score.score4; break;
      }
    }

    static makeDbMessage(data: any): Message {
      const message = new Message(null, new Score(null, 0));
       message.initialize = true;
       message.timestamp = data.timestamp;
       message.intersection = data.intersection;
       message.id = data.message_id;
       message.key = data.message_key;
       message.type = data.message_type;
       message.text = data.message_text;
       message.score = data.score;
       return message;
    }
}

export class CapabilityScore {
    public initialize: boolean = false;
    public timestamp: number;
    public scoreA: number = -1;
    public scoreAMessage: string = "";
    public scoreB: number = -1;
    public scoreBMessage: string = "";
    public scoreC: number = -1;
    public scoreCMessage: string = "";

    constructor(data: any, timestamp: number) {
      if (data == null || data.capabilityScore == null) {
        return;
      }

      this.timestamp = timestamp;

      const capabilityScore = data.capabilityScore;
      if (capabilityScore.score != null) {
        this.scoreA = capabilityScore.score.scoreA ?? -1;
        this.scoreB = capabilityScore.score.scoreA ?? -1;
        this.scoreC = capabilityScore.score.scoreA ?? -1;
      }

      if (capabilityScore.messages != null) {
        if (capabilityScore.messages.messageA != null)
          this.scoreAMessage = capabilityScore.messages.messageA.message ?? '';
        if (capabilityScore.messages.messageB != null)
          this.scoreBMessage = capabilityScore.messages.messageB.message ?? '';
        if (capabilityScore.messages.messageC != null)
          this.scoreCMessage = capabilityScore.messages.messageC.message ?? '';
      }

      if (-1 < this.scoreA
        || -1 < this.scoreB
        || -1 < this.scoreC) {
        this.initialize = true;
      }
    }

    static makeDbCapabilityScore(data: any): CapabilityScore {
      const capabilityScore = new CapabilityScore(null, 0);
      capabilityScore.initialize = true;
      capabilityScore.timestamp = data.timestamp;
      capabilityScore.scoreA = data.score_a;
      capabilityScore.scoreB = data.score_b;
      capabilityScore.scoreC = data.score_c;
      capabilityScore.scoreAMessage = data.score_a_message;
      capabilityScore.scoreBMessage = data.score_b_message;
      capabilityScore.scoreCMessage = data.score_c_message;
      return capabilityScore;
    }
}

export class Score {
    public initialize: boolean = false;
    public timestamp: number;
    public overAll: number = -1;
    public score1: number= -1;
    public score2: number= -1;
    public score3: number= -1;
    public score4: number= -1;
    public hiyari: boolean = false;
    public intersection: string = '';
    public messages = Array<Message>();
    public capabilityScore: CapabilityScore;
    public graphCapabilityScoreList = Array<CapabilityScore>();

    constructor(data: any, timestamp: number, dummy: boolean = false) {
      if (data == null) {
        if (dummy) {
          this.makeDummyData();
        }
        this.capabilityScore = new CapabilityScore(null, 0);
        return;
      }

      this.timestamp = timestamp;

      this.hiyari = data.hiyari ?? false;
      this.intersection = data.intersection ?? false;

      const drivingScore = data.drivingScore;
      if (drivingScore == null || drivingScore.score == null) {
        return;
      }
      this.overAll = drivingScore.score.overAll ?? -1;
      this.score1 = drivingScore.score.score1 ?? -1;
      this.score2 = drivingScore.score.score2 ?? -1;
      this.score3 = drivingScore.score.score3 ?? -1;
      this.score4 = drivingScore.score.score4 ?? -1;

      this.capabilityScore = new CapabilityScore(data, timestamp);

      if (this.overAll !== -1
        || this.score1 !== -1
        || this.score2 !== -1
        || this.score3 !== -1
        || this.score4 !== -1
        || this.hiyari
        || this.capabilityScore.initialize) {
        this.initialize = true;
      }

      if (data.drivingScore.messages == null)
        return;

      for (let i=0; i<data.drivingScore.messages.length; i++) {
        let message = new Message(data.drivingScore.messages[i], this);
        if (message.initialize) {
          this.messages.push(message);
        }
      }
    }

    static makeDbScore(data: any): Score {
      const score = new Score(null, 0);
      score.initialize = true;
      score.timestamp = data.score_id;
      score.overAll = data.score_over_all;
      score.score1 = data.score1;
      score.score2 = data.score2;
      score.score3 = data.score3;
      score.score4 = data.score4;
      return score;
    }

    private makeDummyData() {
      if (Math.random() < 0.5) {
        return;
      }

      this.initialize = true;
      this.timestamp = Date.now();

      this.overAll = Math.random() * 100;
      this.score1 = Math.random() * 100;
      this.score2 = Math.random() * 100;
      this.score3 = Math.random() * 100;
      this.score4 = Math.random() * 100;

      this.hiyari = Math.random() < 0.1;

      if (Math.random() < 0.1) {
        const data = {
          capabilityScore: {
            scoreA: {score:Math.random() * 100, message:"スコアAの能力値に関するテキストメッセージ"},
            scoreB: {score:Math.random() * 100, message:"スコアBの能力値に関するテキストメッセージ"},
            scoreC: {score:Math.random() * 100, message:"スコアCの能力値に関するテキストメッセージ"}
          }
        };
        this.capabilityScore = new CapabilityScore(data, this.timestamp);
      }

      const messageDataList = [];
      if (Math.random() < 0.1) messageDataList.push({id:0, key:"over_all", type:"negative", message:"徐行が不十分で走行していたことがありました。\n見落としの可能性があります。\n十分に速度を落として走行しましょう。"})
      if (Math.random() < 0.1) messageDataList.push({id:1, key:"score3", type:"negative", message:"徐行が不十分で走行していたことがありました。\n見落としの可能性があります。\n十分に速度を落として走行しましょう。"})
      if (Math.random() < 0.1) messageDataList.push({id:2, key:"over_all", type:"positive", message:"しっかりと徐行して走行できてました。\n素晴らしいですね。"})
      if (Math.random() < 0.1) messageDataList.push({id:3, key:"score3", type:"positive", message:"しっかりと徐行して走行できてました。\n素晴らしいですね。"})
      if (Math.random() < 0.1) messageDataList.push({id:4, key:"over_all", type:"negative", message:"急加速で走行したことがありました。\n前方方向の車両に衝突する可能性があります。\n交差点通過時はゆっくり進んでください。"})
      if (Math.random() < 0.1) messageDataList.push({id:5, key:"score1", type:"negative", message:"急加速で走行したことがありました。\n前方方向の車両に衝突する可能性があります。\n交差点通過時はゆっくり進んでください。"})
      if (Math.random() < 0.1) messageDataList.push({id:6, key:"over_all", type:"negative", message:"急加速なく走行していました。\n素晴らしいですね。"})
      if (Math.random() < 0.1) messageDataList.push({id:7, key:"score1", type:"positive", message:"急加速なく走行していました。\n素晴らしいですね。"})
      if (Math.random() < 0.1) messageDataList.push({id:9, key:"score2", type:"negative", message:"急減速で走行したことがありました。\n後続車による衝突の可能性があります。\n交差点通過時は左右確認を忘れずにゆっくり進んでください。"})
      if (Math.random() < 0.1) messageDataList.push({id:13, key:"score4", type:"negative", message:"急ハンドルで走行したことがありました。\n回避先に衝突する確認があります。\n周囲の確認を忘れずに余裕を持って走行してください。"})
      for (const messageData of messageDataList) {
        let message = new Message(messageData, this);
        if (message.initialize) {
          this.messages.push(message);
        }
      }
    }
}
