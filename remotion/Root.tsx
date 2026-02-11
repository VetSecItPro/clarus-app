import { Composition } from "remotion";
import { HeroDemo } from "./compositions/HeroDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroDemo"
        component={HeroDemo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Understand Any Content in Seconds",
        }}
      />
    </>
  );
};
