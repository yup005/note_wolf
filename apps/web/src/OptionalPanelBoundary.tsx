import {Component,type ReactNode} from 'react';
export class OptionalPanelBoundary extends Component<{name:string;children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(!this.state.failed)return this.props.children;
  return <section className="card favorites-panel" aria-label={this.props.name}><div className="section-head"><h2>{this.props.name}</h2></div><p role="alert">暂时无法打开{this.props.name}。其他功能仍可使用。请刷新页面后重试，未提交的内容会清除。</p></section>;
 }
}
